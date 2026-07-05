/**
 * Best-effort recipe extraction from a fetched page's raw HTML. Recipe pages are wildly
 * inconsistent, so this tries the structured path first and only falls back to a loose text
 * heuristic when nothing structured is present — it never throws, and it never invents an
 * ingredient or step that isn't actually traceable to the page: a page that doesn't parse comes
 * back with empty `ingredients` and blank `title`/`instructions` rather than a guess. The calling
 * agent is responsible for treating an empty result as "couldn't find a recipe here" and saying so
 * rather than papering over it.
 */
export interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  instructions: string;
  servings?: number;
  ingredients: ParsedIngredient[];
}

export function parseRecipe(html: string): ParsedRecipe {
  if (!html || typeof html !== 'string') {
    return { title: '', instructions: '', ingredients: [] };
  }

  const structured = parseJsonLdRecipe(html);
  if (structured && (structured.title || structured.ingredients.length > 0)) {
    return structured;
  }

  return parseHeuristically(html);
}

/**
 * Recipe pages that follow schema.org markup (https://schema.org/Recipe) embed a
 * `<script type="application/ld+json">` block — this is by far the most reliable source when
 * present, since it's the same data the page author fed to search engines.
 */
function parseJsonLdRecipe(html: string): ParsedRecipe | null {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let json: unknown;
    try {
      json = JSON.parse(inner);
    } catch {
      continue; // malformed JSON-LD — not fatal, just skip this block
    }

    const recipe = findRecipeNode(json);
    if (recipe) return recipeFromJsonLd(recipe);
  }

  return null;
}

/** JSON-LD can be a single object, an array, or wrapped in an `@graph` — walk all three shapes. */
function findRecipeNode(json: unknown): Record<string, unknown> | null {
  if (Array.isArray(json)) {
    for (const entry of json) {
      const found = findRecipeNode(entry);
      if (found) return found;
    }
    return null;
  }

  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    const type = obj['@type'];
    const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
    if (isRecipe) return obj;

    if (Array.isArray(obj['@graph'])) {
      return findRecipeNode(obj['@graph']);
    }
  }

  return null;
}

function recipeFromJsonLd(node: Record<string, unknown>): ParsedRecipe {
  const title = cleanText(asString(node.name) ?? '');
  const description = asString(node.description);

  const instructionsRaw = node.recipeInstructions;
  const instructions = instructionsToText(instructionsRaw);

  const servings = parseServings(node.recipeYield);

  const rawIngredients = Array.isArray(node.recipeIngredient) ? (node.recipeIngredient as unknown[]) : [];
  const ingredients = rawIngredients
    .map((line) => (typeof line === 'string' ? parseIngredientLine(line) : null))
    .filter((line): line is ParsedIngredient => line !== null);

  return {
    title,
    description: description ? cleanText(description) : undefined,
    instructions,
    servings,
    ingredients,
  };
}

/** `recipeInstructions` can be a plain string, an array of strings, or an array of HowToStep objects. */
function instructionsToText(raw: unknown): string {
  if (typeof raw === 'string') return cleanText(raw);

  if (Array.isArray(raw)) {
    const steps = raw.map((step, i) => {
      if (typeof step === 'string') return `${i + 1}. ${cleanText(step)}`;
      if (step && typeof step === 'object') {
        const text = asString((step as Record<string, unknown>).text) ?? asString((step as Record<string, unknown>).name);
        return text ? `${i + 1}. ${cleanText(text)}` : '';
      }
      return '';
    });
    return steps.filter(Boolean).join('\n');
  }

  return '';
}

/** `recipeYield` can be `"4"`, `"4 servings"`, or a plain number — pull the first integer out. */
function parseServings(raw: unknown): number | undefined {
  const text = typeof raw === 'number' ? String(raw) : asString(raw);
  if (!text) return undefined;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

/**
 * Split a free-text ingredient line like "2 cups all-purpose flour" into quantity/unit/name.
 * Falls back to quantity 1 and unit "unit" when nothing numeric is present (e.g. "salt to taste"),
 * rather than dropping the ingredient entirely — the agent still knows the page mentioned it.
 */
function parseIngredientLine(line: string): ParsedIngredient | null {
  const text = cleanText(line);
  if (!text) return null;

  const match = text.match(/^([\d/.\s]+)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (match) {
    const quantity = parseQuantity(match[1]);
    const unit = match[2] && KNOWN_UNITS.has(match[2].toLowerCase()) ? match[2].toLowerCase() : 'unit';
    const name = unit === 'unit' && match[2] ? `${match[2]} ${match[3]}`.trim() : match[3].trim();
    if (quantity !== null && name) {
      return { name, quantity, unit };
    }
  }

  // No leading quantity found at all — record it with a neutral quantity/unit rather than
  // discarding a real ingredient the page listed (e.g. "salt to taste", "pepper").
  return { name: text, quantity: 1, unit: 'unit' };
}

const KNOWN_UNITS = new Set(['g', 'kg', 'ml', 'l', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'count', 'clove', 'cloves', 'pinch']);

/** Handles whole numbers, decimals, and simple fractions like "1/2" or "1 1/2". */
function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  let total = 0;
  let matchedAny = false;

  for (const part of parts) {
    if (/^\d+\/\d+$/.test(part)) {
      const [n, d] = part.split('/').map(Number);
      if (d) {
        total += n / d;
        matchedAny = true;
      }
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part);
      matchedAny = true;
    }
  }

  return matchedAny ? total : null;
}

/**
 * Heuristic fallback for pages with no JSON-LD Recipe block — much less reliable, so it only
 * grabs a title (from `<title>` or the first `<h1>`) and gives up on ingredients/instructions
 * rather than guessing which list items on the page are actually the ingredient list. An empty
 * `ingredients` array here is the honest signal to the calling agent that this page needs a human,
 * not a confident-looking wrong answer.
 */
function parseHeuristically(html: string): ParsedRecipe {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanText(h1?.[1] ?? titleTag?.[1] ?? '');

  return { title, instructions: '', ingredients: [] };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

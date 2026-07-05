export interface IngredientLike {
  id: string;
  name: string;
}

export interface IngredientMatch {
  /** The id of the matched existing ingredient, or null when nothing matched well enough. */
  id: string | null;
  /** The normalized name used for matching (lowercased, singularized, de-punctuated). */
  normalized: string;
  /** 0..1 confidence; 1 = exact normalized-name hit, lower = fuzzy token overlap. */
  score: number;
}

/**
 * Normalizes a free-text ingredient name into a stable match key: lowercase, strip punctuation
 * and parenthetical notes ("(finely chopped)"), collapse whitespace, drop a trailing plural "s".
 * This is the same normalization the importer applies on BOTH sides of a match so "Tomatoes" from a
 * scraped page and "tomato" already in the pantry resolve to the same key.
 */
export function normalizeIngredientName(raw: string): string {
  const base = (raw ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical notes
    .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
  // Naive singularize the last word (handles the common "tomatoes"/"onions" case).
  return base.replace(/(\w+?)(?:es|s)\b$/, (m, stem) => (stem.length >= 3 ? stem : m));
}

/**
 * Find-or-flag: given a parsed ingredient name and the current pantry `ingredients`, return the best
 * existing match so the importer reuses a row instead of creating a duplicate. Matching is purely
 * deterministic — exact normalized-name equality scores 1.0; otherwise a Jaccard token-overlap over
 * the normalized words, and only overlaps at/above `threshold` (default 0.6) count as a match. A
 * miss returns `{ id: null }`, the importer's signal to create a fresh `ingredients` row. Never
 * invents an ingredient; it only reconciles a parsed name against what already exists.
 */
export function matchIngredient(
  name: string,
  existing: IngredientLike[],
  threshold = 0.6,
): IngredientMatch {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return { id: null, normalized, score: 0 };

  let best: IngredientMatch = { id: null, normalized, score: 0 };
  const wantTokens = new Set(normalized.split(' ').filter(Boolean));

  for (const cand of existing) {
    const candNorm = normalizeIngredientName(cand.name);
    if (candNorm === normalized) return { id: cand.id, normalized, score: 1 };
    const candTokens = new Set(candNorm.split(' ').filter(Boolean));
    const inter = [...wantTokens].filter((t) => candTokens.has(t)).length;
    const union = new Set([...wantTokens, ...candTokens]).size || 1;
    const score = inter / union;
    if (score > best.score) best = { id: cand.id, normalized, score };
  }
  return best.score >= threshold ? best : { id: null, normalized, score: best.score };
}

type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'improviseTonight';
export const description =
  'Cook-from-what-I-have: rank the recipe box by what tonight can actually be cooked from the pantry, favoring pantry coverage, expiry-urgency, and past ratings. Returns the top few candidates to slot into tonight.';

export interface Input {
  /** how many candidates to return (default 3). */
  limit?: number;
}

export interface Candidate {
  recipeId: string;
  title: string;
  prepMinutes: number;
  imageUrl?: string;
  /** 0..1 fraction of non-optional ingredient lines the pantry already covers. */
  coverage: number;
  /** average past rating (1..5) for this recipe, or null if never cooked. */
  rating: number | null;
  /** true if this recipe uses an ingredient that's expiring soon. */
  usesExpiring: boolean;
  /** one short human reason it's a good pick tonight. */
  reason: string;
}

export interface Output {
  candidates: Candidate[];
}

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  expiresAt?: string | null;
}
interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  optional?: boolean;
}
interface Recipe {
  id: string;
  title: string;
  prepMinutes?: number;
  imageUrl?: string;
  tags?: string[];
  cuisine?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
}
interface PlanMeal {
  recipeId: string;
  rating?: number | null;
}
interface Settings {
  diet?: string;
  allergies?: string[];
  maxPrepMinutes?: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const limit = Math.max(1, Math.min(6, input.limit ?? 3));

  const pantry = (await ctx.db.query('ingredients')) as Ingredient[];
  const onHand = new Map<string, number>(pantry.map((i) => [i.id, i.quantity ?? 0]));
  const soon = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const expiringIds = new Set(
    pantry
      .filter((i) => i.expiresAt && new Date(i.expiresAt).getTime() <= soon && (i.quantity ?? 0) > 0)
      .map((i) => i.id),
  );

  const settings = ((await ctx.db.query('settings')) as Settings[])[0];
  const allergies = (settings?.allergies ?? []).map((a) => String(a).toLowerCase());

  // Average past ratings per recipe (taste history).
  const history = (await ctx.db.query('plan_meals')) as PlanMeal[];
  const ratingAcc = new Map<string, { sum: number; n: number }>();
  for (const h of history) {
    if (h.rating == null) continue;
    const acc = ratingAcc.get(h.recipeId) ?? { sum: 0, n: 0 };
    acc.sum += h.rating;
    acc.n += 1;
    ratingAcc.set(h.recipeId, acc);
  }

  const recipes = (await ctx.db.query('recipes')) as Recipe[];

  const scored: Array<Candidate & { score: number }> = [];
  for (const r of recipes) {
    if (r.title === 'Importing…' || r.title === 'Import failed') continue;

    const withLines = ((await ctx.db.query('recipes', {
      where: { id: r.id },
      include: ['ingredients'],
    })) as Recipe[])[0];
    const lines = (withLines?.ingredients ?? []).filter((l) => !l.optional);

    // Hard allergy filter — never propose something the household can't eat.
    if (allergies.length) {
      const names = await Promise.all(
        lines.map(async (l) => {
          const ing = ((await ctx.db.query('ingredients', { where: { id: l.ingredientId } })) as Ingredient[])[0];
          return (ing?.name ?? '').toLowerCase();
        }),
      );
      if (names.some((n) => allergies.some((a) => a && n.includes(a)))) continue;
    }

    // Coverage: fraction of non-optional lines the pantry meets.
    let covered = 0;
    let usesExpiring = false;
    for (const l of lines) {
      const have = onHand.get(l.ingredientId) ?? 0;
      const need = l.quantity ?? 0;
      if (need <= 0 || have >= need) covered += 1;
      if (expiringIds.has(l.ingredientId)) usesExpiring = true;
    }
    const coverage = lines.length === 0 ? 1 : covered / lines.length;

    const acc = ratingAcc.get(r.id);
    const rating = acc && acc.n > 0 ? acc.sum / acc.n : null;

    // Composite score: coverage dominates, expiry-urgency and taste tilt ties.
    let score = coverage * 100;
    if (usesExpiring) score += 25;
    if (rating != null) score += (rating - 3) * 6;
    if (settings?.maxPrepMinutes && (r.prepMinutes ?? 30) <= settings.maxPrepMinutes) score += 5;

    const reason = usesExpiring
      ? 'uses an ingredient expiring soon'
      : coverage >= 0.99
        ? 'fully cookable from your pantry'
        : coverage >= 0.6
          ? `mostly in stock (${Math.round(coverage * 100)}% covered)`
          : rating != null && rating >= 4
            ? 'a past favorite'
            : `${Math.round(coverage * 100)}% of ingredients on hand`;

    scored.push({
      recipeId: r.id,
      title: r.title,
      prepMinutes: r.prepMinutes ?? 30,
      imageUrl: r.imageUrl,
      coverage: Math.round(coverage * 100) / 100,
      rating: rating != null ? Math.round(rating * 10) / 10 : null,
      usesExpiring,
      reason,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, limit).map(({ score, ...c }) => c);
  return { candidates };
}

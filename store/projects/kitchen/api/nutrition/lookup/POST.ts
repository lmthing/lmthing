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

export const name = 'lookupNutrition';
export const description =
  'Ground one ingredient\'s nutrition facts against USDA FoodData Central (real per-100g macros), scaled to the ingredient\'s unit, and upsert nutrition_facts with a usda:<fdcId> provenance. Degrades gracefully to grounded:false when FDC_API_KEY is unconfigured or the lookup fails — the nutritionist then falls back to its estimate.';

export interface Input {
  ingredientId: string;
}

export interface Facts {
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  basisNote: string;
  source: string;
}

export interface Output {
  grounded: boolean;
  facts: Facts | null;
  reason?: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

/** USDA nutrient numbers: 1008 Energy(kcal), 1003 Protein, 1005 Carbs, 1004 Total lipid(fat). */
function nutrientAmount(nutrients: any[], id: number): number {
  const n = (nutrients ?? []).find(
    (x) => x?.nutrientId === id || x?.nutrient?.number === String(id) || x?.number === String(id),
  );
  return n ? Number(n.value ?? n.amount ?? 0) || 0 : 0;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const ingRows = (await ctx.db.query('ingredients', { where: { id: input.ingredientId } })) as Ingredient[];
  const ing = ingRows[0];
  if (!ing) return { grounded: false, facts: null, reason: 'ingredient not found' };

  const apiKey = process.env.FDC_API_KEY;
  if (!apiKey) {
    // Feature-flagged: no key configured. The nutritionist's own estimate remains authoritative.
    return { grounded: false, facts: null, reason: 'FDC_API_KEY not configured' };
  }

  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(ing.name)}` +
      `&pageSize=1&dataType=Foundation,SR%20Legacy&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return { grounded: false, facts: null, reason: `FDC ${res.status}` };
    const body = (await res.json()) as any;
    const food = body?.foods?.[0];
    if (!food) return { grounded: false, facts: null, reason: 'no FDC match' };

    const per100 = {
      calories: nutrientAmount(food.foodNutrients, 1008),
      protein: nutrientAmount(food.foodNutrients, 1003),
      carbs: nutrientAmount(food.foodNutrients, 1005),
      fat: nutrientAmount(food.foodNutrients, 1004),
    };

    // FDC macros are per 100g/ml. For g/ml units that's a divide-by-100; 'count' has no reliable
    // weight from FDC, so leave it to the estimate rather than guess a per-piece mass.
    const unit = (ing.unit ?? 'g').toLowerCase();
    if (unit === 'count') {
      return { grounded: false, facts: null, reason: 'count unit needs a per-piece mass FDC does not provide' };
    }
    const scale = 1 / 100;
    const facts: Facts = {
      caloriesPerUnit: Math.round(per100.calories * scale * 100) / 100,
      proteinPerUnit: Math.round(per100.protein * scale * 100) / 100,
      carbsPerUnit: Math.round(per100.carbs * scale * 100) / 100,
      fatPerUnit: Math.round(per100.fat * scale * 100) / 100,
      basisNote: `USDA FDC #${food.fdcId} (${food.description ?? ing.name}), per 1${unit} from per-100${unit}`,
      source: `usda:${food.fdcId}`,
    };

    const existing = (await ctx.db.query('nutrition_facts', {
      where: { ingredientId: input.ingredientId },
    })) as Row[];
    if (existing[0]) {
      await ctx.db.update('nutrition_facts', {
        where: { ingredientId: input.ingredientId },
        set: { ...facts, updatedAt: new Date().toISOString() },
      });
    } else {
      await ctx.db.insert('nutrition_facts', { ingredientId: input.ingredientId, ...facts });
    }

    return { grounded: true, facts };
  } catch (e) {
    return { grounded: false, facts: null, reason: (e as Error)?.message ?? 'lookup failed' };
  }
}

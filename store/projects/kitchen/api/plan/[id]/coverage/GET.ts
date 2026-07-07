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

export const name = 'planCoverage';
export const description =
  "How cookable-from-pantry this week's plan is: the percentage of the plan's non-optional ingredient lines already on hand, the number of items still to buy, and how many meal slots are filled vs the 7-dinner target. Drives the home-screen coverage ribbon and plan progress bar.";

export interface Input {
  id: string;
}

export interface Output {
  cookablePct: number;
  itemsToBuy: number;
  mealsPlanned: number;
  mealsTarget: number;
  status: string;
}

interface MealPlan {
  id: string;
  status: string;
  meals: PlanMeal[];
}
interface PlanMeal {
  id: string;
  recipeId: string;
  day: string;
  servings: number;
}
interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  optional?: boolean;
}
interface Recipe {
  id: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
}
interface Ingredient {
  id: string;
  quantity: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const planRows = (await ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],
  })) as MealPlan[];
  const plan = planRows[0];

  if (!plan) {
    return { cookablePct: 0, itemsToBuy: 0, mealsPlanned: 0, mealsTarget: 7, status: 'none' };
  }

  const meals = Array.isArray(plan.meals) ? plan.meals : [];
  const mealsPlanned = new Set(meals.filter((m) => m.meal !== undefined || true).map((m) => `${m.day}`)).size;

  const pantry = (await ctx.db.query('ingredients')) as Ingredient[];
  const onHand = new Map<string, number>(pantry.map((i) => [i.id, i.quantity ?? 0]));

  // Aggregate the whole week's needs, then diff against the pantry once.
  const needByIngredient = new Map<string, number>();
  for (const m of meals) {
    const recipe = ((await ctx.db.query('recipes', {
      where: { id: m.recipeId },
      include: ['ingredients'],
    })) as Recipe[])[0];
    if (!recipe) continue;
    const base = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
    const scale = (m.servings || base) / base;
    for (const line of recipe.ingredients ?? []) {
      if (line.optional) continue;
      const prev = needByIngredient.get(line.ingredientId) ?? 0;
      needByIngredient.set(line.ingredientId, prev + (line.quantity ?? 0) * scale);
    }
  }

  let lines = 0;
  let coveredLines = 0;
  let itemsToBuy = 0;
  for (const [ingredientId, need] of needByIngredient) {
    lines += 1;
    const have = onHand.get(ingredientId) ?? 0;
    if (need <= 0 || have >= need) coveredLines += 1;
    else itemsToBuy += 1;
  }

  const cookablePct = lines === 0 ? 100 : Math.round((coveredLines / lines) * 100);

  return {
    cookablePct,
    itemsToBuy,
    mealsPlanned,
    mealsTarget: 7,
    status: plan.status,
  };
}

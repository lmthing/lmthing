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

export const name = 'currentPlan';
export const description = "Get the current (most recent by week) meal plan, with its meals and each meal's recipe hydrated.";

export interface Input {}

interface Recipe {
  id: string;
  title: string;
  description?: string;
  instructions: string;
  servings: number;
  prepMinutes: number;
  tags: string[];
  imageUrl?: string;
  source?: string;
}

interface PlanMeal {
  id: string;
  planId: string;
  recipeId: string;
  day: string;
  meal: string;
  servings: number;
  recipe: Recipe | null;
}

interface MealPlan {
  id: string;
  weekStart: string;
  status: string;
  createdAt: string;
  meals: PlanMeal[];
}

export interface Output {
  plan: MealPlan | null;
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const plans = (await ctx.db.query('meal_plans')) as MealPlan[];
  if (plans.length === 0) {
    return { plan: null };
  }

  let current = plans[0];
  for (const p of plans) {
    if ((p.weekStart ?? '') > (current.weekStart ?? '')) {
      current = p;
    }
  }

  const rows = (await ctx.db.query('meal_plans', {
    where: { id: current.id },
    include: ['meals'],
  })) as MealPlan[];

  const plan = rows[0];
  if (!plan) {
    return { plan: null };
  }

  const recipes = (await ctx.db.query('recipes')) as Recipe[];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const meals = Array.isArray(plan.meals) ? plan.meals : [];
  plan.meals = meals.map((m) => ({
    ...m,
    recipe: recipeById.get(m.recipeId) ?? null,
  }));

  return { plan };
}

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

export const name = 'kitchenStats';
export const description = 'Summary counts: total recipes, pantry items, low-stock items, meals planned this week, and remaining shopping gaps.';

export interface Input {}

export interface Output {
  recipes: number;
  pantryItems: number;
  lowStock: number;
  plannedMeals: number;
  shoppingGaps: number;
}

interface Ingredient {
  id: string;
  quantity: number;
  lowStockThreshold: number;
}

interface MealPlan {
  id: string;
  weekStart: string;
}

interface PlanMeal {
  id: string;
  planId: string;
}

interface ShoppingRow {
  id: string;
  planId: string;
  bought: boolean;
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const recipes = await ctx.db.query('recipes');
  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const lowStock = ingredients.filter((i) => (i.quantity ?? 0) <= (i.lowStockThreshold ?? 0)).length;

  const plans = (await ctx.db.query('meal_plans')) as MealPlan[];
  let currentPlanId: string | null = null;
  if (plans.length > 0) {
    let current = plans[0];
    for (const p of plans) {
      if ((p.weekStart ?? '') > (current.weekStart ?? '')) {
        current = p;
      }
    }
    currentPlanId = current.id;
  }

  let plannedMeals = 0;
  let shoppingGaps = 0;
  if (currentPlanId) {
    const meals = (await ctx.db.query('plan_meals', { where: { planId: currentPlanId } })) as PlanMeal[];
    plannedMeals = meals.length;

    const shopping = (await ctx.db.query('shopping_list', { where: { planId: currentPlanId } })) as ShoppingRow[];
    shoppingGaps = shopping.filter((s) => !s.bought).length;
  }

  return {
    recipes: recipes.length,
    pantryItems: ingredients.length,
    lowStock,
    plannedMeals,
    shoppingGaps,
  };
}

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

import { HttpError } from '@app/runtime';

export const name = 'getShoppingTrip';
export const description = "Compute a plan's shopping gaps and group them by aisle (ingredient category) with estimated cost.";

export interface Input {
  id: string;
}

interface AisleLine {
  ingredient: string;
  unit: string;
  quantity: number;
  estCost: number;
}

interface Aisle {
  aisle: string;
  lines: AisleLine[];
}

export interface Output {
  aisles: Aisle[];
  estimatedCost: number;
}

interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
}

interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  optional: boolean;
}

interface Recipe {
  id: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

interface PlanMeal {
  id: string;
  planId: string;
  recipeId: string;
  servings: number;
}

interface MealPlan {
  id: string;
  meals: PlanMeal[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const planRows = (await ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],
  })) as MealPlan[];
  const plan = planRows[0];
  if (!plan) {
    throw new HttpError(404, 'plan not found');
  }

  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const required = new Map<string, number>();

  for (const meal of plan.meals ?? []) {
    const recipeRows = (await ctx.db.query('recipes', {
      where: { id: meal.recipeId },
      include: ['ingredients'],
    })) as Recipe[];
    const recipe = recipeRows[0];
    if (!recipe) continue;

    const scale = recipe.servings > 0 ? (meal.servings ?? recipe.servings) / recipe.servings : 1;

    for (const line of recipe.ingredients ?? []) {
      if (line.optional) continue;
      const need = (line.quantity ?? 0) * scale;
      required.set(line.ingredientId, (required.get(line.ingredientId) ?? 0) + need);
    }
  }

  const byAisle = new Map<string, AisleLine[]>();
  let estimatedCost = 0;

  for (const [ingredientId, requiredQty] of required.entries()) {
    const ing = ingredientById.get(ingredientId);
    const pantryQty = ing?.quantity ?? 0;
    const gap = requiredQty - pantryQty;
    if (gap <= 0) continue;

    const aisle = ing?.category || 'other';
    const estCost = gap * (ing?.costPerUnit ?? 0);
    estimatedCost += estCost;

    const lines = byAisle.get(aisle) ?? [];
    lines.push({
      ingredient: ing?.name ?? '',
      unit: ing?.unit ?? '',
      quantity: gap,
      estCost,
    });
    byAisle.set(aisle, lines);
  }

  const aisles: Aisle[] = Array.from(byAisle.entries())
    .map(([aisle, lines]) => ({ aisle, lines }))
    .sort((a, b) => a.aisle.localeCompare(b.aisle));

  return { aisles, estimatedCost };
}

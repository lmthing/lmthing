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

export const name = 'getRecipeNutrition';
export const description = "Compute a recipe's total and per-serving nutrition from its ingredient lines' nutrition facts.";

export interface Input {
  id: string;
}

interface Macro {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Output extends Macro {
  perServing: Macro;
  missing: string[];
}

interface Ingredient {
  id: string;
  name: string;
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

interface NutritionFacts {
  id: string;
  ingredientId: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('recipes', {
    where: { id: input.id },
    include: ['ingredients'],
  })) as Recipe[];

  const recipe = rows[0];
  if (!recipe) {
    throw new HttpError(404, 'recipe not found');
  }

  const totals: Macro = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const missing: string[] = [];

  for (const line of recipe.ingredients ?? []) {
    if (line.optional) continue;

    const factsRows = (await ctx.db.query('nutrition_facts', {
      where: { ingredientId: line.ingredientId },
    })) as NutritionFacts[];
    const facts = factsRows[0];

    if (!facts) {
      const ingredientRows = (await ctx.db.query('ingredients', {
        where: { id: line.ingredientId },
      })) as Ingredient[];
      missing.push(ingredientRows[0]?.name ?? line.ingredientId);
      continue;
    }

    const qty = line.quantity ?? 0;
    totals.calories += (facts.caloriesPerUnit ?? 0) * qty;
    totals.protein += (facts.proteinPerUnit ?? 0) * qty;
    totals.carbs += (facts.carbsPerUnit ?? 0) * qty;
    totals.fat += (facts.fatPerUnit ?? 0) * qty;
  }

  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const perServing: Macro = {
    calories: totals.calories / servings,
    protein: totals.protein / servings,
    carbs: totals.carbs / servings,
    fat: totals.fat / servings,
  };

  return {
    ...totals,
    perServing,
    missing,
  };
}

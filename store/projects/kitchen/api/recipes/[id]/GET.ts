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

export const name = 'getRecipe';
export const description = "Get a recipe by id, with its ingredient lines hydrated with pantry ingredient details.";

export interface Input {
  id: string;
}

interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  optional: boolean;
  ingredient: Ingredient | null;
}

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
  ingredients: RecipeIngredient[];
}

export type Output = Recipe;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('recipes', {
    where: { id: input.id },
    include: ['ingredients'],
  })) as Recipe[];

  const recipe = rows[0];
  if (!recipe) {
    throw new HttpError(404, 'recipe not found');
  }

  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  recipe.ingredients = (recipe.ingredients ?? []).map((line) => ({
    ...line,
    ingredient: ingredientById.get(line.ingredientId) ?? null,
  }));

  return recipe;
}

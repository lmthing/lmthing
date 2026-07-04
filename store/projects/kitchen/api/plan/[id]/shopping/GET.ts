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

export const name = 'shoppingList';
export const description = "Get a plan's shopping list — persisted rows if any exist, otherwise computed on the fly as this week's required ingredient quantities minus current pantry stock.";

export interface Input {
  id: string;
}

interface ShoppingItem {
  id: string | null;
  ingredientId: string;
  ingredient: string;
  unit: string;
  quantity: number;
  bought: boolean;
}

export interface Output {
  items: ShoppingItem[];
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
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

interface ShoppingRow {
  id: string;
  planId: string;
  ingredientId: string;
  quantity: number;
  bought: boolean;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const planRows = (await ctx.db.query('meal_plans', { where: { id: input.id } })) as MealPlan[];
  const plan = planRows[0];
  if (!plan) {
    throw new HttpError(404, 'plan not found');
  }

  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const persisted = (await ctx.db.query('shopping_list', {
    where: { planId: input.id },
  })) as ShoppingRow[];

  if (persisted.length > 0) {
    const items: ShoppingItem[] = persisted.map((row) => {
      const ing = ingredientById.get(row.ingredientId);
      return {
        id: row.id,
        ingredientId: row.ingredientId,
        ingredient: ing?.name ?? '',
        unit: ing?.unit ?? '',
        quantity: row.quantity,
        bought: row.bought === true,
      };
    });
    return { items };
  }

  const planWithMeals = (await ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],
  })) as MealPlan[];
  const meals = planWithMeals[0]?.meals ?? [];

  const required = new Map<string, number>();

  for (const meal of meals) {
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

  const items: ShoppingItem[] = [];
  for (const [ingredientId, requiredQty] of required.entries()) {
    const ing = ingredientById.get(ingredientId);
    const pantryQty = ing?.quantity ?? 0;
    const gap = requiredQty - pantryQty;
    if (gap > 0) {
      items.push({
        id: null,
        ingredientId,
        ingredient: ing?.name ?? '',
        unit: ing?.unit ?? '',
        quantity: gap,
        bought: false,
      });
    }
  }

  return { items };
}

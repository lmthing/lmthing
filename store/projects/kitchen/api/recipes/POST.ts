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

export const name = 'addRecipe';
export const description = 'Add a new recipe, finding-or-creating each ingredient it calls for and linking the quantities needed.';

export interface Input {
  title: string;
  instructions: string;
  description?: string;
  servings?: number;
  prepMinutes?: number;
  tags?: string[];
  imageUrl?: string;
  ingredients?: Array<{ name: string; quantity: number; unit: string; optional?: boolean }>;
}

export interface Recipe {
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

export type Output = Recipe;

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const recipe = (await ctx.db.insert('recipes', {
    title: input.title,
    instructions: input.instructions,
    description: input.description,
    servings: input.servings ?? 2,
    prepMinutes: input.prepMinutes ?? 30,
    tags: input.tags ?? [],
    imageUrl: input.imageUrl,
    source: 'chef',
  })) as Recipe;

  for (const line of input.ingredients ?? []) {
    const existing = (await ctx.db.query('ingredients', {
      where: { name: line.name },
    })) as Ingredient[];

    let ingredient = existing[0];
    if (!ingredient) {
      ingredient = (await ctx.db.insert('ingredients', {
        name: line.name,
        unit: line.unit,
        quantity: 0,
      })) as Ingredient;
    }

    await ctx.db.insert('recipe_ingredients', {
      recipeId: recipe.id,
      ingredientId: ingredient.id,
      quantity: line.quantity,
      optional: line.optional ?? false,
    });
  }

  return recipe;
}

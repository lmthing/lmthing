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

export const name = 'listRecipes';
export const description = 'List all recipes, sorted by title, optionally filtered by tag.';

export interface Input {
  tag?: string;
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

export type Output = Recipe[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('recipes', {
    orderBy: { column: 'title', dir: 'asc' },
  })) as Recipe[];

  let recipes = rows;
  if (input.tag) {
    const tag = input.tag;
    recipes = recipes.filter((r) => Array.isArray(r.tags) && r.tags.includes(tag));
  }

  return recipes;
}

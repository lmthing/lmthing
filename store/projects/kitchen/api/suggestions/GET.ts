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

export const name = 'listSuggestions';
export const description = 'List active (non-dismissed) suggestions, optionally filtered by type, newest/highest-priority first, with ingredient/recipe hydrated.';

export interface Input {
  type?: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface Recipe {
  id: string;
  title: string;
}

interface Suggestion {
  id: string;
  type: string;
  title: string;
  body: string;
  ingredientId: string | null;
  recipeId: string | null;
  priority: number;
  dismissed: boolean;
  createdAt: string;
  ingredient?: Ingredient | null;
  recipe?: Recipe | null;
}

export type Output = Suggestion[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('suggestions')) as Suggestion[];

  let active = rows.filter((s) => !s.dismissed);
  if (input.type) {
    active = active.filter((s) => s.type === input.type);
  }

  active.sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });

  const result: Suggestion[] = [];
  for (const s of active) {
    let ingredient: Ingredient | null = null;
    let recipe: Recipe | null = null;

    if (s.ingredientId) {
      const ingredientRows = (await ctx.db.query('ingredients', {
        where: { id: s.ingredientId },
      })) as Ingredient[];
      ingredient = ingredientRows[0] ?? null;
    }

    if (s.recipeId) {
      const recipeRows = (await ctx.db.query('recipes', {
        where: { id: s.recipeId },
      })) as Recipe[];
      recipe = recipeRows[0] ?? null;
    }

    result.push({ ...s, ingredient, recipe });
  }

  return result;
}

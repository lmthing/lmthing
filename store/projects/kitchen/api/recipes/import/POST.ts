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

export const name = 'importRecipe';
export const description = 'Create a stub recipe from a source URL and kick off the importer to fill in its details.';

export interface Input {
  url: string;
}

export interface Output {
  recipeId: string;
  status: string;
}

interface Recipe {
  id: string;
  title: string;
  instructions: string;
  source: string;
  servings: number;
  prepMinutes: number;
  tags: string[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('recipes', {
    title: 'Importing…',
    instructions: '',
    source: input.url,
    servings: 2,
    prepMinutes: 30,
    tags: [],
  })) as Recipe;

  const recipeId = created.id;

  await ctx.spawn('sourcing/importer#import', { recipeId, url: input.url }, {
    onError: async () => {
      // best-effort: leave the stub recipe in place if the importer run fails
      await ctx.db.update('recipes', {
        where: { id: recipeId },
        set: { title: 'Import failed' },
      });
    },
  });

  return { recipeId, status: 'importing' };
}

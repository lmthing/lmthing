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

export const name = 'importRecipeText';
export const description =
  'Create a stub recipe from pasted free text (a WhatsApp message, a photo caption, OCR text) and kick off the importer to extract a structured recipe from it — the paste-anything counterpart to importRecipe.';

export interface Input {
  /** the raw pasted recipe text — prose, a list, or a messy screenshot transcription. */
  text: string;
}

export interface Output {
  recipeId: string;
  status: string;
}

interface Recipe {
  id: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const text = (input.text ?? '').trim();
  if (text.length < 8) {
    throw new HttpError(400, 'paste some recipe text first');
  }

  const created = (await ctx.db.insert('recipes', {
    title: 'Importing…',
    instructions: '',
    source: 'pasted',
    servings: 2,
    prepMinutes: 30,
    tags: [],
  })) as Recipe;

  const recipeId = created.id;

  await ctx.spawn(
    'sourcing/importer#paste',
    { recipeId, text },
    {
      onError: async () => {
        await ctx.db.update('recipes', {
          where: { id: recipeId },
          set: { title: 'Import failed' },
        });
      },
    },
  );

  return { recipeId, status: 'importing' };
}

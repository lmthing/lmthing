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

export const name = 'listAllSubstitutions';
export const description =
  'List all known ingredient substitutions across the pantry (the Swaps view), each with the original ingredient name hydrated. Written by the nightly sourcing optimizer.';

export interface Input {}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}
interface Substitution {
  id: string;
  ingredientId: string;
  substituteName: string;
  ratio: number;
  reason?: string;
  note?: string;
  createdAt: string;
}

export interface SubstitutionWithIngredient extends Substitution {
  ingredientName: string;
  unit: string;
}

export type Output = SubstitutionWithIngredient[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const subs = (await ctx.db.query('substitutions')) as Substitution[];
  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  return subs.map((s) => {
    const ing = byId.get(s.ingredientId);
    return {
      ...s,
      ingredientName: ing?.name ?? 'Unknown ingredient',
      unit: ing?.unit ?? '',
    };
  });
}

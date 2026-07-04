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

export const name = 'listPantry';
export const description = 'List all pantry ingredients, sorted by category then name.';

export interface Input {}

export interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type Output = Ingredient[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('ingredients')) as Ingredient[];

  rows.sort((a, b) => {
    const catDiff = (a.category ?? '').localeCompare(b.category ?? '');
    if (catDiff !== 0) return catDiff;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return rows;
}

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

export const name = 'listExpiring';
export const description = 'List pantry ingredients that expire within a given number of days (default 3), soonest first.';

export interface Input {
  withinDays?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  expiresAt: string | null;
  updatedAt: string;
}

export type Output = Ingredient[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const withinDays = input.withinDays ?? 3;
  const rows = (await ctx.db.query('ingredients')) as Ingredient[];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + withinDays);

  const expiring = rows.filter((i) => {
    if (!i.expiresAt) return false;
    const expiresAt = new Date(i.expiresAt);
    return expiresAt.getTime() <= cutoff.getTime();
  });

  expiring.sort((a, b) => new Date(a.expiresAt as string).getTime() - new Date(b.expiresAt as string).getTime());

  return expiring;
}

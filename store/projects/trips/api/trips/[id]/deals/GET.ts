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

export const name = 'listDeals';
export const description = 'List money-saving deals the deal-hunter has found for a trip.';

export interface Input {
  id: string;
}

export interface Deal {
  id: string;
  tripId: string;
  kind: string;
  title: string;
  description?: string;
  estimatedSavings: number;
  currency: string;
  url?: string;
  status: string;
  expiresAt?: string;
  foundAt: string;
}

export interface Output {
  deals: Deal[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const deals = (await ctx.db.query('deals', { where: { tripId: input.id } })) as Deal[];
  return { deals };
}

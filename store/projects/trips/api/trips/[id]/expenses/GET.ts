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

export const name = 'listExpenses';
export const description = 'List expenses recorded on a trip, most recent first.';

export interface Input {
  id: string;
}

export interface Expense {
  id: string;
  tripId: string;
  paidByTravelerId?: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurredAt?: string;
  bookingId?: string;
  itineraryItemId?: string;
  createdAt: string;
}

export interface Output {
  expenses: Expense[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const expenses = (await ctx.db.query('expenses', { where: { tripId: input.id } })) as Expense[];

  expenses.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return { expenses };
}

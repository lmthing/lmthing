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

export const name = 'addExpense';
export const description = 'Record a new expense on a trip. Defaults currency to the trip home currency. Triggers the treasurer split hook.';

export interface Input {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency?: string;
  paidByTravelerId?: string;
  incurredAt?: string;
  bookingId?: string;
  itineraryItemId?: string;
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

export type Output = Expense;

interface Trip {
  id: string;
  homeCurrency?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  let currency = input.currency;
  if (!currency) {
    const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
    currency = trips[0]?.homeCurrency ?? 'USD';
  }

  // The split-new-expense DB hook reacts to this insert to create expense_shares — do not spawn here.
  const expense = (await ctx.db.insert('expenses', {
    tripId: input.id,
    category: input.category,
    description: input.description,
    amount: input.amount,
    currency,
    paidByTravelerId: input.paidByTravelerId,
    incurredAt: input.incurredAt,
    bookingId: input.bookingId,
    itineraryItemId: input.itineraryItemId,
  })) as Output;

  return expense;
}

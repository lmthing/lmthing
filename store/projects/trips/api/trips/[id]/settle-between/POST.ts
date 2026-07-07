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

export const name = 'settleBetween';
export const description =
  'Mark a whole settlement edge paid: settle every unsettled expense_share owed by `fromTravelerId` on expenses paid by `toTravelerId` for this trip. Backs the "Mark paid" button on a transfer row.';

export interface Input {
  id: string;
  fromTravelerId: string;
  toTravelerId: string;
}

export interface Output {
  settled: number;
}

interface Expense {
  id: string;
  paidByTravelerId?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const expenses = (await ctx.db.query('expenses', {
    where: { tripId: input.id, paidByTravelerId: input.toTravelerId },
  })) as Expense[];

  const settledAt = new Date().toISOString();
  let settled = 0;
  for (const exp of expenses) {
    const n = await ctx.db.update('expense_shares', {
      where: { expenseId: exp.id, travelerId: input.fromTravelerId, settled: false },
      set: { settled: true, settledAt },
    });
    settled += n;
  }
  return { settled };
}

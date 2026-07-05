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

export const name = 'settleShare';
export const description = 'Mark an expense share as settled (or unsettled).';

export interface Input {
  id: string;
  settled?: boolean;
}

export interface Output {
  ok: boolean;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const settled = input.settled !== undefined ? input.settled : true;

  const count = await ctx.db.update('expense_shares', {
    where: { id: input.id },
    set: { settled, settledAt: settled ? new Date().toISOString() : null },
  });

  return { ok: count > 0 };
}

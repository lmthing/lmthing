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

export const name = 'markRead';
export const description = 'Mark a single article as read.';

export interface Input {
  id: string;
}

export interface Output {
  ok: boolean;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const count = await ctx.db.update('articles', {
    where: { id: input.id },
    set: { read: true },
  });
  return { ok: count > 0 };
}

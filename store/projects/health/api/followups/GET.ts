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

export const name = 'listFollowups';
export const description = 'List follow-up reminders, optionally limited to those currently due, sorted by due date ascending.';

export interface Input {
  dueOnly?: boolean;
}

export interface Followup {
  id: string;
  topic: string;
  reason?: string;
  dueAt: string;
  done: boolean;
  labResultId?: string;
  createdAt: string;
}

export type Output = Followup[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('followups')) as Followup[];

  const filtered = input.dueOnly
    ? rows.filter((f) => !f.done && new Date(f.dueAt) <= new Date())
    : rows;

  filtered.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));

  return filtered;
}

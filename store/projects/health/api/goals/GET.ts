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

export const name = 'listGoals';
export const description = 'List health goals, most recently created first.';

export interface Input {}

export interface Goal {
  id: string;
  title: string;
  metricKind?: string;
  target?: number;
  current: number;
  status: string;
  dueAt?: string;
  createdAt: string;
}

export type Output = Goal[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('goals')) as Goal[];

  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return rows;
}

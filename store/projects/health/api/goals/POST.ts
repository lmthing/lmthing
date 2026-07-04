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

export const name = 'createGoal';
export const description = 'Create a new health goal to track progress toward.';

export interface Input {
  title: string;
  metricKind?: string;
  target?: number;
  dueAt?: string;
}

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

export type Output = Goal;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('goals', {
    title: input.title,
    metricKind: input.metricKind,
    target: input.target,
    current: 0,
    status: 'active',
    dueAt: input.dueAt,
  })) as Goal;

  return created;
}

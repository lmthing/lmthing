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

import { HttpError } from '@app/runtime';

export const name = 'updateGoal';
export const description = "Update a goal's current progress, status, and/or due date.";

export interface Input {
  id: string;
  current?: number;
  status?: string;
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
  const set: Record<string, unknown> = {};
  if (input.current !== undefined) set.current = input.current;
  if (input.status !== undefined) set.status = input.status;
  if (input.dueAt !== undefined) set.dueAt = input.dueAt;

  const n = await ctx.db.update('goals', { where: { id: input.id }, set });

  if (n === 0) {
    throw new HttpError(404, 'goal not found');
  }

  const rows = (await ctx.db.query('goals', { where: { id: input.id } })) as Goal[];

  return rows[0];
}

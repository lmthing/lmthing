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

export const name = 'completeFollowup';
export const description = 'Mark a follow-up reminder as done.';

export interface Input {
  id: string;
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

export type Output = Followup;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const n = await ctx.db.update('followups', {
    where: { id: input.id },
    set: { done: true },
  });

  if (n === 0) {
    throw new HttpError(404, 'follow-up not found');
  }

  const rows = (await ctx.db.query('followups', { where: { id: input.id } })) as Followup[];

  return rows[0];
}

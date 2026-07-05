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

export const name = 'getShare';
export const description = 'Get a care-summary export by id.';

export interface Input {
  id: string;
}

interface CareShare {
  id: string;
  title: string;
  scope: string;
  body?: string;
  status: string;
  token: string;
  createdAt: string;
}

export type Output = CareShare;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('care_shares', { where: { id: input.id } })) as CareShare[];

  const share = rows[0];
  if (!share) {
    throw new HttpError(404, 'care share not found');
  }

  return share;
}

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

import { randomUUID } from 'node:crypto';

export const name = 'createShare';
export const description = 'Request a printable care-summary export compiled from the record.';

export interface Input {
  title?: string;
  scope?: string;
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

export interface Output {
  shareId: string;
  status: 'pending';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const token = randomUUID();

  const created = (await ctx.db.insert('care_shares', {
    title: input.title ?? 'Care summary',
    scope: input.scope ?? 'summary',
    status: 'pending',
    token,
  })) as CareShare;

  return { shareId: created.id, status: 'pending' };
}

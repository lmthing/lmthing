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

export const name = 'pollSource';
export const description = 'Kick off the clipper to politely poll a saved-search source for new listings.';

export interface Input {
  id: string;
}

export interface Output {
  ok: true;
  status: 'polling';
}

interface Source {
  id: string;
  url?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('sources', { where: { id: input.id } })) as Source[];
  const source = rows[0];
  if (!source) {
    throw new HttpError(404, 'source not found');
  }
  if (!source.url) {
    throw new HttpError(404, 'source has no url to poll');
  }

  await ctx.spawn('intake/clipper#poll', { sourceId: input.id }, { onError: () => {} });

  return { ok: true, status: 'polling' };
}

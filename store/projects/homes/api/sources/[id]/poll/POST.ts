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

  // The poll is driven by a `database` hook, NOT `ctx.spawn`: stamping a manual-poll
  // request (`pollRequestedAt`) is a `sources` UPDATE that fires the `poll-source-now`
  // hook → `intake/clipper#poll` (its declarative trigger — the same reliably-routed
  // path the poll cron uses). `politeFetchPlan` treats a pending request as eligible for
  // one poll (bypassing the recurring `pollEnabled`/interval), then clears it as
  // `lastPolledAt` advances past it. (The runtime's `spawn()` seam is a real
  // fire-and-forget agent runner now, but this decoupled write-driven path is the tested,
  // per-source-gated one — kept deliberately over a bare spawn.)
  await ctx.db.update('sources', {
    where: { id: input.id },
    set: { pollRequestedAt: new Date().toISOString() },
  });

  return { ok: true, status: 'polling' };
}

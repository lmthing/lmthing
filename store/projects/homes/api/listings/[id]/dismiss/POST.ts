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

export const name = 'dismissListing';
export const description = 'Dismiss a listing and log a dismiss signal — the reason is the highest-value taste evidence the ranker gets.';

export interface Input {
  id: string;
  reason?: string;
}

export interface Output {
  ok: true;
}

interface Listing {
  id: string;
  searchId: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('listings', { where: { id: input.id } })) as Listing[];
  const listing = rows[0];
  if (!listing) {
    throw new HttpError(404, 'listing not found');
  }

  await ctx.db.update('listings', {
    where: { id: input.id },
    set: { status: 'dismissed', dismissedReason: input.reason },
  });

  await ctx.db.insert('taste_signals', {
    searchId: listing.searchId,
    listingId: input.id,
    action: 'dismiss',
    reason: input.reason,
  });

  return { ok: true };
}

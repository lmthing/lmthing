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

export const name = 'updateSource';
export const description = 'Update a capture source. Re-enabling polling clears any prior block reason. Poll interval is floored at 6 hours.';

export interface Input {
  id: string;
  label?: string;
  pollEnabled?: boolean;
  pollIntervalHours?: number;
  notes?: string;
}

export interface Source {
  id: string;
  searchId: string;
  kind: string;
  label: string;
  url?: string;
  pollEnabled: boolean;
  pollIntervalHours: number;
  lastPolledAt?: string;
  blockedReason?: string;
  notes?: string;
  lastIngestedAt?: string;
  createdAt: string;
}

export type Output = Source;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.label !== undefined) set.label = input.label;
  if (input.pollEnabled !== undefined) {
    set.pollEnabled = input.pollEnabled;
    if (input.pollEnabled === true) {
      set.blockedReason = null;
    }
  }
  if (input.pollIntervalHours !== undefined) {
    set.pollIntervalHours = Math.max(6, input.pollIntervalHours);
  }
  if (input.notes !== undefined) set.notes = input.notes;

  await ctx.db.update('sources', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('sources', { where: { id: input.id } })) as Source[];
  const source = rows[0];
  if (!source) {
    throw new HttpError(404, 'source not found');
  }

  return source;
}

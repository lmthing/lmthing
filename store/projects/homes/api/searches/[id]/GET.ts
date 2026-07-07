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

export const name = 'getSearch';
export const description = 'Get a single home search with its sources.';

export interface Input {
  id: string;
}

interface CommuteTarget {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

interface Source {
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

export interface Output {
  id: string;
  title: string;
  brief?: string;
  mode: string;
  area?: string;
  budgetMax: number;
  budgetMin: number;
  currency: string;
  minRooms: number;
  minAreaSqm: number;
  mustHaves: string[];
  commuteTargets: CommuteTarget[];
  status: string;
  createdAt: string;
  sources: Source[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('searches', {
    where: { id: input.id },
    include: ['sources'],
  })) as Output[];

  const search = rows[0];
  if (!search) {
    throw new HttpError(404, 'search not found');
  }

  return search;
}

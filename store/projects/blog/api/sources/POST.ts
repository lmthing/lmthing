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

export const name = 'addSource';
export const description = 'Add a new source (rss or search), subject to the free-tier source cap.';

export interface Input {
  kind: string;
  value: string;
  label?: string;
  topics?: string[];
}

export interface Source {
  id: string;
  kind: string;
  value: string;
  label: string;
  topics: string[];
  active: boolean;
  lastFetchedAt: string;
  createdAt: string;
}

export type Output = Source;

interface Setting {
  id: string;
  tier: 'free' | 'subscription';
  weeklyBudgetUsd: number;
  maxFreeSources: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (input.kind !== 'rss' && input.kind !== 'search') {
    throw new HttpError(400, "kind must be 'rss' or 'search'");
  }

  const settingsRows = (await ctx.db.query('settings')) as Setting[];
  const settings: Setting = settingsRows[0] ?? {
    id: '',
    tier: 'free',
    weeklyBudgetUsd: 1,
    maxFreeSources: 5,
  };

  if (settings.tier === 'free') {
    const existing = await ctx.db.query('sources');
    if (existing.length >= settings.maxFreeSources) {
      throw new HttpError(402, 'Upgrade to add more sources');
    }
  }

  try {
    const r = (await ctx.db.insert('sources', {
      kind: input.kind,
      value: input.value,
      label: input.label ?? input.value,
      topics: input.topics ?? [],
      active: true,
    })) as Source;
    return r;
  } catch (err) {
    throw new HttpError(409, 'source already added');
  }
}

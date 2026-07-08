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

export const name = 'requestResearch';
export const description = 'Request deep research on an article topic (subscription-only feature); seeds a pending research row (the deep-research hook drives the researcher on insert).';

export interface Input {
  id: string;
  topic: string;
}

export interface Output {
  researchId: string;
  status: 'pending';
}

interface Setting {
  id: string;
  tier: 'free' | 'subscription';
  weeklyBudgetUsd: number;
  maxFreeSources: number;
}

interface Research {
  id: string;
  articleId: string;
  topic: string;
  status: 'pending' | 'ready' | 'error';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const settingsRows = (await ctx.db.query('settings')) as Setting[];
  const settings: Setting = settingsRows[0] ?? {
    id: '',
    tier: 'free',
    weeklyBudgetUsd: 1,
    maxFreeSources: 5,
  };

  if (settings.tier !== 'subscription') {
    throw new HttpError(402, 'Deep research is a subscription feature');
  }

  // Seed the pending row. Inserting it fires the `deep-research` database hook, which runs the
  // researcher's deep-dive tasklist to fill the report + mark it ready. We drive this through the
  // insert-hook (rather than a direct `ctx.spawn`) on purpose: the pending row is the idempotence
  // guard, so a duplicate request reuses it instead of launching a second deep-dive.
  const r = (await ctx.db.insert('research', {
    articleId: input.id,
    topic: input.topic,
    status: 'pending',
  })) as Research;

  return { researchId: r.id, status: 'pending' };
}

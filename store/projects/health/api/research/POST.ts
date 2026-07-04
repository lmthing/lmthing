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
export const description = 'Request a deep-dive research report on a topic, optionally tied to a lab result or symptom. Subscription-tier only.';

export interface Input {
  topic: string;
  labResultId?: string;
  symptomId?: string;
}

interface Setting {
  id: string;
  tier: string;
  weeklyBudgetUsd: number;
  acceptedDisclaimer: boolean;
}

interface Research {
  id: string;
  labResultId?: string;
  symptomId?: string;
  topic: string;
  body?: string;
  status: string;
  createdAt: string;
}

export interface Output {
  researchId: string;
  status: 'pending';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const settings = (await ctx.db.query('settings')) as Setting[];
  const row = settings[0];

  if (!row || row.tier !== 'subscription') {
    throw new HttpError(402, 'Deep research is a subscription feature');
  }

  const created = (await ctx.db.insert('research', {
    topic: input.topic,
    labResultId: input.labResultId,
    symptomId: input.symptomId,
    status: 'pending',
  })) as Research;

  return { researchId: created.id, status: 'pending' };
}

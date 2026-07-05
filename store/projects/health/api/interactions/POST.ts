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

export const name = 'checkInteractions';
export const description = 'Request a literature-backed interaction review for a medication. Subscription-tier only.';

export interface Input {
  medicationId: string;
}

interface Setting {
  id: string;
  tier: string;
  weeklyBudgetUsd: number;
  acceptedDisclaimer: boolean;
}

interface Medication {
  id: string;
  name: string;
}

interface Interaction {
  id: string;
  medicationId: string;
  otherName: string;
  severity: string;
  body?: string;
  status: string;
  createdAt: string;
}

export interface Output {
  interactionId: string;
  status: 'pending';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.medicationId) {
    throw new HttpError(400, 'medicationId is required');
  }

  const settings = (await ctx.db.query('settings')) as Setting[];
  const settingsRow = settings[0];

  if (!settingsRow || settingsRow.tier !== 'subscription') {
    throw new HttpError(402, 'Interaction review is a subscription feature');
  }

  const medications = (await ctx.db.query('medications', { where: { id: input.medicationId } })) as Medication[];
  if (!medications[0]) {
    throw new HttpError(400, 'medication not found');
  }

  const created = (await ctx.db.insert('interactions', {
    medicationId: input.medicationId,
    otherName: '',
    severity: 'unknown',
    status: 'pending',
  })) as Interaction;

  return { interactionId: created.id, status: 'pending' };
}

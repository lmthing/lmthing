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

export const name = 'logDose';
export const description = 'Log a medication dose as taken, missed, skipped, or pending.';

export interface Input {
  medicationId: string;
  status?: string;
  scheduledAt?: string;
  takenAt?: string;
  note?: string;
}

export interface AdherenceLog {
  id: string;
  medicationId: string;
  scheduledAt: string;
  takenAt?: string;
  status: string;
  note?: string;
}

export type Output = AdherenceLog;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.medicationId) {
    throw new HttpError(400, 'medicationId is required');
  }

  const now = new Date().toISOString();

  let status = input.status;
  let takenAt = input.takenAt;

  if (!status) {
    status = takenAt ? 'taken' : 'pending';
  }
  if (status === 'taken' && !takenAt) {
    takenAt = now;
  }

  const scheduledAt = input.scheduledAt ?? takenAt ?? now;

  const created = (await ctx.db.insert('adherence_logs', {
    medicationId: input.medicationId,
    scheduledAt,
    takenAt,
    status,
    note: input.note,
  })) as AdherenceLog;

  return created;
}

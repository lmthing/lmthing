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

export const name = 'addAppointment';
export const description = 'Add a new appointment to track.';

export interface Input {
  title: string;
  provider?: string;
  location?: string;
  kind?: string;
  scheduledAt: string;
  note?: string;
}

export interface Appointment {
  id: string;
  title: string;
  provider?: string;
  location?: string;
  kind: string;
  scheduledAt: string;
  status: string;
  prepBriefId?: string;
  note?: string;
  createdAt: string;
}

export type Output = Appointment;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.title) {
    throw new HttpError(400, 'title is required');
  }
  if (!input.scheduledAt) {
    throw new HttpError(400, 'scheduledAt is required');
  }

  const created = (await ctx.db.insert('appointments', {
    title: input.title,
    provider: input.provider,
    location: input.location,
    kind: input.kind ?? 'doctor',
    scheduledAt: input.scheduledAt,
    status: 'scheduled',
    note: input.note,
  })) as Appointment;

  return created;
}

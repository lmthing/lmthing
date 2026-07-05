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

export const name = 'updateAppointment';
export const description = "Update an appointment's status, scheduled time, prep brief, and/or note.";

export interface Input {
  id: string;
  status?: string;
  scheduledAt?: string;
  prepBriefId?: string;
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
  if (!input.id) {
    throw new HttpError(400, 'id is required');
  }

  const set: Record<string, unknown> = {};
  if (input.status !== undefined) set.status = input.status;
  if (input.scheduledAt !== undefined) set.scheduledAt = input.scheduledAt;
  if (input.prepBriefId !== undefined) set.prepBriefId = input.prepBriefId;
  if (input.note !== undefined) set.note = input.note;

  const n = await ctx.db.update('appointments', { where: { id: input.id }, set });

  if (n === 0) {
    throw new HttpError(404, 'appointment not found');
  }

  const rows = (await ctx.db.query('appointments', { where: { id: input.id } })) as Appointment[];

  return rows[0];
}

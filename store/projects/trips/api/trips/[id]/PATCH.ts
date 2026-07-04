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

export const name = 'updateTrip';
export const description = 'Update fields on a trip.';

export interface Input {
  id: string;
  title?: string;
  brief?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  budgetUsd?: number;
}

export interface Trip {
  id: string;
  title: string;
  brief: string;
  startDate?: string;
  endDate?: string;
  status: string;
  budgetUsd: number;
  createdAt: string;
}

export type Output = Trip;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.brief !== undefined) set.brief = input.brief;
  if (input.startDate !== undefined) set.startDate = input.startDate;
  if (input.endDate !== undefined) set.endDate = input.endDate;
  if (input.status !== undefined) set.status = input.status;
  if (input.budgetUsd !== undefined) set.budgetUsd = input.budgetUsd;

  await ctx.db.update('trips', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const trip = rows[0];
  if (!trip) {
    throw new HttpError(404, 'trip not found');
  }

  return trip;
}

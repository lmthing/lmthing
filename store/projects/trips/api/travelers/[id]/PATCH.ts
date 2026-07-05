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

export const name = 'updateTraveler';
export const description = 'Update fields on a traveler.';

export interface Input {
  id: string;
  name?: string;
  role?: string;
  homeCountry?: string;
  email?: string;
  notes?: string;
}

export interface Traveler {
  id: string;
  tripId: string;
  name: string;
  role: string;
  homeCountry?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type Output = Traveler;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.role !== undefined) set.role = input.role;
  if (input.homeCountry !== undefined) set.homeCountry = input.homeCountry;
  if (input.email !== undefined) set.email = input.email;
  if (input.notes !== undefined) set.notes = input.notes;

  await ctx.db.update('travelers', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('travelers', { where: { id: input.id } })) as Traveler[];
  const traveler = rows[0];
  if (!traveler) {
    throw new HttpError(404, 'traveler not found');
  }

  return traveler;
}

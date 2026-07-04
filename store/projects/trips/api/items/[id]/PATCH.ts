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

export const name = 'updateItem';
export const description = 'Update fields on an itinerary item.';

export interface Input {
  id: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  kind?: string;
  title?: string;
  location?: string;
  notes?: string;
  estimatedCost?: number;
  currency?: string;
}

export interface ItineraryItem {
  id: string;
  destinationId: string;
  day: string;
  startTime?: string;
  endTime?: string;
  kind: string;
  title: string;
  location?: string;
  notes?: string;
  estimatedCost: number;
  currency: string;
  bookingId?: string;
}

export type Output = ItineraryItem;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.day !== undefined) set.day = input.day;
  if (input.startTime !== undefined) set.startTime = input.startTime;
  if (input.endTime !== undefined) set.endTime = input.endTime;
  if (input.kind !== undefined) set.kind = input.kind;
  if (input.title !== undefined) set.title = input.title;
  if (input.location !== undefined) set.location = input.location;
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.estimatedCost !== undefined) set.estimatedCost = input.estimatedCost;
  if (input.currency !== undefined) set.currency = input.currency;

  await ctx.db.update('itinerary_items', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('itinerary_items', {
    where: { id: input.id },
  })) as ItineraryItem[];
  const item = rows[0];
  if (!item) {
    throw new HttpError(404, 'itinerary item not found');
  }

  return item;
}

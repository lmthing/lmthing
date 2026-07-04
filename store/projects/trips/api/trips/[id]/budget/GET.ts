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

export const name = 'tripBudget';
export const description = 'Roll up a trip budget: booked cost, estimated cost, remaining, broken down by kind.';

export interface Input {
  id: string;
}

export interface BudgetByKind {
  kind: string;
  booked: number;
  estimated: number;
}

export interface Output {
  budgetUsd: number;
  booked: number;
  estimated: number;
  remaining: number;
  byKind: BudgetByKind[];
}

interface Trip {
  id: string;
  budgetUsd: number;
}

interface Destination {
  id: string;
  tripId: string;
}

interface ItineraryItem {
  id: string;
  destinationId: string;
  kind: string;
  estimatedCost: number;
}

interface Booking {
  id: string;
  tripId: string;
  kind: string;
  cost: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const tripRows = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const trip = tripRows[0];
  if (!trip) {
    throw new HttpError(404, 'trip not found');
  }

  const bookings = (await ctx.db.query('bookings', { where: { tripId: input.id } })) as Booking[];
  const destinations = (await ctx.db.query('destinations', {
    where: { tripId: input.id },
  })) as Destination[];
  const destIds = new Set(destinations.map((d) => d.id));

  const allItems = (await ctx.db.query('itinerary_items')) as ItineraryItem[];
  const items = allItems.filter((item) => destIds.has(item.destinationId));

  const booked = bookings.reduce((sum, b) => sum + (b.cost ?? 0), 0);
  const estimated = items.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0);
  const budgetUsd = trip.budgetUsd ?? 0;

  const byKindMap = new Map<string, BudgetByKind>();
  const getEntry = (kind: string): BudgetByKind => {
    let entry = byKindMap.get(kind);
    if (!entry) {
      entry = { kind, booked: 0, estimated: 0 };
      byKindMap.set(kind, entry);
    }
    return entry;
  };

  for (const b of bookings) {
    getEntry(b.kind ?? 'other').booked += b.cost ?? 0;
  }
  for (const i of items) {
    getEntry(i.kind ?? 'other').estimated += i.estimatedCost ?? 0;
  }

  return {
    budgetUsd,
    booked,
    estimated,
    remaining: budgetUsd - booked - estimated,
    byKind: Array.from(byKindMap.values()),
  };
}

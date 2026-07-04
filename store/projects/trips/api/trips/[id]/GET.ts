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

export const name = 'getTrip';
export const description = 'Get a single trip with its destinations (each with itinerary items) and bookings.';

export interface Input {
  id: string;
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

export interface Destination {
  id: string;
  tripId: string;
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  orderIndex: number;
  notes?: string;
  items: ItineraryItem[];
}

export interface Booking {
  id: string;
  tripId: string;
  kind: string;
  provider?: string;
  confirmation?: string;
  cost: number;
  startAt?: string;
  endAt?: string;
  url?: string;
}

export interface Output {
  id: string;
  title: string;
  brief: string;
  startDate?: string;
  endDate?: string;
  status: string;
  budgetUsd: number;
  createdAt: string;
  destinations: Destination[];
  bookings: Booking[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('trips', {
    where: { id: input.id },
    include: ['destinations', 'bookings'],
  })) as Output[];

  const trip = rows[0];
  if (!trip) {
    throw new HttpError(404, 'trip not found');
  }

  for (const dest of trip.destinations ?? []) {
    const items = (await ctx.db.query('itinerary_items', {
      where: { destinationId: dest.id },
    })) as ItineraryItem[];

    items.sort((a, b) => {
      const dayDiff = (a.day ?? '').localeCompare(b.day ?? '');
      if (dayDiff !== 0) return dayDiff;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });

    dest.items = items;
  }

  trip.destinations = (trip.destinations ?? []).sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );

  return trip;
}

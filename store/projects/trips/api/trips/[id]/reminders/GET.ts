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

export const name = 'tripReminders';
export const description = 'List itinerary items on this trip that still need booking, with days-left and urgency, soonest deadline first.';

export interface Input {
  id: string;
}

interface Destination {
  id: string;
  tripId: string;
}

export interface ItineraryItem {
  id: string;
  destinationId: string;
  day: string;
  kind: string;
  title: string;
  location?: string;
  notes?: string;
  needsBooking: boolean;
  bookByDate?: string;
  bookingId?: string;
}

export interface Output {
  reminders: (ItineraryItem & { daysLeft: number | null; urgency: string })[];
}

const MS_PER_DAY = 86400000;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const destinations = (await ctx.db.query('destinations', {
    where: { tripId: input.id },
  })) as Destination[];
  const destIds = new Set(destinations.map((d) => d.id));

  const allItems = (await ctx.db.query('itinerary_items')) as ItineraryItem[];
  const pending = allItems.filter(
    (item) => destIds.has(item.destinationId) && item.needsBooking === true && !item.bookingId
  );

  const today = Date.now();

  const reminders = pending.map((item) => {
    let daysLeft: number | null = null;
    if (item.bookByDate) {
      daysLeft = Math.floor((new Date(item.bookByDate).getTime() - today) / MS_PER_DAY);
    }
    const urgency = daysLeft === null ? 'later' : daysLeft < 0 ? 'overdue' : daysLeft <= 14 ? 'soon' : 'later';
    return { ...item, daysLeft, urgency };
  });

  reminders.sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return 0;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  return { reminders };
}

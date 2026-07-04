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

export const name = 'addBooking';
export const description = 'Add a confirmed booking to a trip.';

export interface Input {
  tripId: string;
  kind: string;
  provider?: string;
  confirmation?: string;
  cost?: number;
  startAt?: string;
  endAt?: string;
  url?: string;
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

export type Output = Booking;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const booking = (await ctx.db.insert('bookings', {
    tripId: input.tripId,
    kind: input.kind,
    provider: input.provider,
    confirmation: input.confirmation,
    cost: input.cost ?? 0,
    startAt: input.startAt,
    endAt: input.endAt,
    url: input.url,
  })) as Booking;

  return booking;
}

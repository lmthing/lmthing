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

export const name = 'transitLegs';
export const description = 'List a trip\'s transit legs with resolved from/to destination names, ordered by departure (soonest first, undated last).';

export interface Input {
  id: string;
}

export interface TransitLeg {
  id: string;
  tripId: string;
  fromDestinationId?: string;
  toDestinationId: string;
  mode: string;
  departAt?: string;
  arriveAt?: string;
  durationMinutes?: number;
  estimatedCost: number;
  currency: string;
  bookByDate?: string;
  notes?: string;
  status: string;
}

interface Destination {
  id: string;
  tripId: string;
  name: string;
  orderIndex: number;
}

export interface Output {
  legs: (TransitLeg & { fromName?: string; toName?: string })[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const transitLegRows = (await ctx.db.query('transit_legs', {
    where: { tripId: input.id },
  })) as TransitLeg[];

  const destinations = (await ctx.db.query('destinations', {
    where: { tripId: input.id },
  })) as Destination[];
  const destById = new Map(destinations.map((d) => [d.id, d]));

  const legs = transitLegRows.map((leg) => ({
    ...leg,
    fromName: leg.fromDestinationId ? destById.get(leg.fromDestinationId)?.name : undefined,
    toName: destById.get(leg.toDestinationId)?.name,
  }));

  legs.sort((a, b) => {
    if (a.departAt && b.departAt) {
      return a.departAt.localeCompare(b.departAt);
    }
    if (a.departAt && !b.departAt) return -1;
    if (!a.departAt && b.departAt) return 1;

    const aOrder = destById.get(a.toDestinationId)?.orderIndex ?? 0;
    const bOrder = destById.get(b.toDestinationId)?.orderIndex ?? 0;
    return aOrder - bOrder;
  });

  return { legs };
}

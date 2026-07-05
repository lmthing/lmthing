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

export const name = 'removeTraveler';
export const description = "Remove a traveler and recompute the trip's partySize.";

export interface Input {
  id: string;
}

export interface Output {
  ok: boolean;
}

interface Traveler {
  id: string;
  tripId: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('travelers', { where: { id: input.id } })) as Traveler[];
  const traveler = rows[0];

  const count = await ctx.db.remove('travelers', { where: { id: input.id } });

  if (traveler) {
    const remaining = (await ctx.db.query('travelers', { where: { tripId: traveler.tripId } })) as Traveler[];
    await ctx.db.update('trips', { where: { id: traveler.tripId }, set: { partySize: remaining.length } });
  }

  return { ok: count > 0 };
}

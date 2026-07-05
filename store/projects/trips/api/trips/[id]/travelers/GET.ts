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

export const name = 'listTravelers';
export const description = 'List the travelers on a trip.';

export interface Input {
  id: string;
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

export interface Output {
  travelers: Traveler[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const travelers = (await ctx.db.query('travelers', { where: { tripId: input.id } })) as Traveler[];
  return { travelers };
}

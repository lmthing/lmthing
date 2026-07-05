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

export const name = 'addTraveler';
export const description = "Add a traveler to a trip's party and keep the trip's partySize in sync. Triggers the reconcile-traveler hook.";

export interface Input {
  id: string;
  name: string;
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
  const traveler = (await ctx.db.insert('travelers', {
    tripId: input.id,
    name: input.name,
    role: input.role ?? 'companion',
    homeCountry: input.homeCountry,
    email: input.email,
    notes: input.notes,
  })) as Output;

  const travelers = (await ctx.db.query('travelers', { where: { tripId: input.id } })) as Traveler[];
  await ctx.db.update('trips', { where: { id: input.id }, set: { partySize: travelers.length } });

  return traveler;
}

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

export const name = 'addDestination';
export const description = 'Add a destination to a trip. Triggers the research-new-destination hook automatically.';

export interface Input {
  id: string;
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  orderIndex?: number;
  notes?: string;
}

export interface Output {
  id: string;
  tripId: string;
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  orderIndex: number;
  notes?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const destination = (await ctx.db.insert('destinations', {
    tripId: input.id,
    name: input.name,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    orderIndex: input.orderIndex ?? 0,
    notes: input.notes,
  })) as Output;

  return destination;
}

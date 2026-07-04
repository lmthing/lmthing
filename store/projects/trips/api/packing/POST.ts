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

export const name = 'addPackingItem';
export const description = 'Add a packing item to a trip.';

export interface Input {
  tripId: string;
  label: string;
  category?: string;
  reason?: string;
}

export interface Output {
  id: string;
  tripId: string;
  label: string;
  category: string;
  reason?: string;
  packed: boolean;
  createdAt: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const item = (await ctx.db.insert('packing_items', {
    tripId: input.tripId,
    label: input.label,
    category: input.category ?? 'other',
    reason: input.reason,
    packed: false,
  })) as Output;

  return item;
}

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

export const name = 'setPreference';
export const description = 'Record a typed preference (diet, mobility, interest, pace, budget) for a traveler.';

export interface Input {
  id: string;
  category: string;
  value: string;
  weight?: number;
  notes?: string;
}

export interface TravelerPreference {
  id: string;
  travelerId: string;
  category: string;
  value: string;
  weight: number;
  notes?: string;
  createdAt: string;
}

export type Output = TravelerPreference;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const preference = (await ctx.db.insert('traveler_preferences', {
    travelerId: input.id,
    category: input.category,
    value: input.value,
    weight: input.weight ?? 0.5,
    notes: input.notes,
  })) as Output;

  return preference;
}

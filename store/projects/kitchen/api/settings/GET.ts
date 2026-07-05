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

export const name = 'getSettings';
export const description = 'Get the household settings row, seeding a default one if none exists yet.';

export interface Input {}

export interface Settings {
  id: string;
  householdSize: number;
  diet: string;
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  maxPrepMinutes: number;
  calorieTarget: number;
  proteinTarget: number;
  updatedAt: string;
}

export type Output = Settings;

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('settings')) as Settings[];
  const existing = rows[0];
  if (existing) {
    return existing;
  }

  const created = (await ctx.db.insert('settings', {
    householdSize: 2,
    diet: 'none',
    allergies: [],
    dislikes: [],
    cuisines: [],
    maxPrepMinutes: 45,
    calorieTarget: 2000,
    proteinTarget: 80,
    updatedAt: new Date().toISOString(),
  })) as Settings;

  return created;
}

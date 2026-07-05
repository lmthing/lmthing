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

export const name = 'updateSettings';
export const description = 'Update the household settings row (diet, allergies, targets, etc.), seeding a default row first if none exists.';

export interface Input {
  householdSize?: number;
  diet?: string;
  allergies?: string[];
  dislikes?: string[];
  cuisines?: string[];
  maxPrepMinutes?: number;
  calorieTarget?: number;
  proteinTarget?: number;
}

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

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('settings')) as Settings[];
  let settings = rows[0];

  if (!settings) {
    settings = (await ctx.db.insert('settings', {
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
  }

  const set: Record<string, unknown> = {};
  if (input.householdSize !== undefined) set.householdSize = input.householdSize;
  if (input.diet !== undefined) set.diet = input.diet;
  if (input.allergies !== undefined) set.allergies = input.allergies;
  if (input.dislikes !== undefined) set.dislikes = input.dislikes;
  if (input.cuisines !== undefined) set.cuisines = input.cuisines;
  if (input.maxPrepMinutes !== undefined) set.maxPrepMinutes = input.maxPrepMinutes;
  if (input.calorieTarget !== undefined) set.calorieTarget = input.calorieTarget;
  if (input.proteinTarget !== undefined) set.proteinTarget = input.proteinTarget;
  set.updatedAt = new Date().toISOString();

  await ctx.db.update('settings', {
    where: { id: settings.id },
    set,
  });

  const updated = (await ctx.db.query('settings', { where: { id: settings.id } })) as Settings[];
  return updated[0];
}

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
export const description = 'Get the app settings, creating a default free-tier row if none exists.';

export interface Input {}

export interface Setting {
  id: string;
  tier: 'free' | 'subscription';
  weeklyBudgetUsd: number;
  maxFreeSources: number;
}

export type Output = Setting;

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('settings')) as Setting[];

  if (rows.length === 0) {
    const created = (await ctx.db.insert('settings', {
      tier: 'free',
      weeklyBudgetUsd: 1,
      maxFreeSources: 5,
    })) as Setting;
    return created;
  }

  return rows[0];
}

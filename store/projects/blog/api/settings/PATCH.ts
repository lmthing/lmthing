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
export const description = 'Update account settings (currently the newsletter delivery email), creating the row if none exists.';

export interface Input {
  deliveryEmail?: string;
}

export interface Setting {
  id: string;
  tier: 'free' | 'subscription';
  weeklyBudgetUsd: number;
  maxFreeSources: number;
  deliveryEmail?: string;
}

export type Output = Setting;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('settings')) as Setting[];

  const set: Record<string, unknown> = {};
  if (typeof input.deliveryEmail === 'string') {
    set.deliveryEmail = input.deliveryEmail.trim();
  }

  if (rows.length === 0) {
    const created = (await ctx.db.insert('settings', {
      tier: 'free',
      weeklyBudgetUsd: 1,
      maxFreeSources: 5,
      ...set,
    })) as Setting;
    return created;
  }

  if (Object.keys(set).length > 0) {
    await ctx.db.update('settings', { where: { id: rows[0].id }, set });
  }
  const updated = (await ctx.db.query('settings')) as Setting[];
  return updated[0];
}

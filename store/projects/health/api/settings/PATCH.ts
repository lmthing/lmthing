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

import { HttpError } from '@app/runtime';

export const name = 'updateSettings';
export const description =
  'Update the user\'s dashboard/notification preferences — pinned dashboard metrics and the reminder delivery channel. Tier and disclaimer are managed elsewhere.';

export interface Input {
  pinnedMetrics?: string[];
  notifyChannel?: 'in_app' | 'email' | 'telegram';
  notifyEmail?: string;
  notifyTelegramChatId?: string;
}

export interface Setting {
  id: string;
  tier: string;
  weeklyBudgetUsd: number;
  acceptedDisclaimer: boolean;
  pinnedMetrics?: string[];
  notifyChannel?: string;
  notifyEmail?: string;
  notifyTelegramChatId?: string;
}

export type Output = Setting;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('settings')) as Setting[];
  let row = rows[0];
  if (!row) {
    row = (await ctx.db.insert('settings', {
      tier: 'free',
      weeklyBudgetUsd: 1,
      acceptedDisclaimer: false,
    })) as Setting;
  }

  const set: Record<string, unknown> = {};
  if (input.pinnedMetrics !== undefined) {
    if (!Array.isArray(input.pinnedMetrics)) throw new HttpError(400, 'pinnedMetrics must be an array');
    set.pinnedMetrics = input.pinnedMetrics.slice(0, 8);
  }
  if (input.notifyChannel !== undefined) {
    if (!['in_app', 'email', 'telegram'].includes(input.notifyChannel)) {
      throw new HttpError(400, 'invalid notifyChannel');
    }
    set.notifyChannel = input.notifyChannel;
  }
  if (input.notifyEmail !== undefined) set.notifyEmail = input.notifyEmail;
  if (input.notifyTelegramChatId !== undefined) set.notifyTelegramChatId = input.notifyTelegramChatId;

  if (Object.keys(set).length > 0) {
    await ctx.db.update('settings', { where: { id: row.id }, set });
  }

  const after = (await ctx.db.query('settings', { where: { id: row.id } })) as Setting[];
  return after[0] ?? row;
}

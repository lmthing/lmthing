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

export const name = 'updateSubscription';
export const description = 'Update a subscription\'s name, query, cadence, or active state.';

export interface Input {
  id: string;
  name?: string;
  query?: unknown;
  cadence?: string;
  active?: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  query: unknown;
  cadence: string;
  channel: string;
  active: boolean;
  lastRunAt: string;
  createdAt: string;
}

export type Output = Subscription;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('subscriptions', { where: { id: input.id } })) as Subscription[];
  const existing = rows[0];
  if (!existing) {
    throw new HttpError(404, 'subscription not found');
  }

  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.query !== undefined) set.query = input.query;
  if (input.cadence !== undefined) set.cadence = input.cadence;
  if (input.active !== undefined) set.active = input.active;

  await ctx.db.update('subscriptions', { where: { id: input.id }, set });

  return { ...existing, ...set } as Subscription;
}

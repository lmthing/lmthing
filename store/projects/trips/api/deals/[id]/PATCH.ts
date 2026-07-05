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

export const name = 'updateDeal';
export const description = "Update a deal's status ('active' | 'taken' | 'expired').";

export interface Input {
  id: string;
  status?: string;
}

export interface Deal {
  id: string;
  tripId: string;
  kind: string;
  title: string;
  description?: string;
  estimatedSavings: number;
  currency: string;
  url?: string;
  status: string;
  expiresAt?: string;
  foundAt: string;
}

export type Output = Deal;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.status !== undefined) set.status = input.status;

  await ctx.db.update('deals', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('deals', { where: { id: input.id } })) as Deal[];
  const deal = rows[0];
  if (!deal) {
    throw new HttpError(404, 'deal not found');
  }

  return deal;
}

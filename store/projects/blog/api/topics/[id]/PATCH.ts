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

export const name = 'updateTopic';
export const description = 'Update a topic\'s followed/muted state or personalization weight.';

export interface Input {
  id: string;
  followed?: boolean;
  muted?: boolean;
  weight?: number;
}

export interface Topic {
  id: string;
  slug: string;
  label: string;
  followed: boolean;
  muted: boolean;
  weight: number;
  articleCount: number;
  createdAt: string;
}

export type Output = Topic;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('topics', { where: { id: input.id } })) as Topic[];
  const existing = rows[0];
  if (!existing) {
    throw new HttpError(404, 'topic not found');
  }

  const set: Record<string, unknown> = {};
  if (input.followed !== undefined) set.followed = input.followed;
  if (input.muted !== undefined) set.muted = input.muted;
  if (input.weight !== undefined) set.weight = input.weight;

  if (Object.keys(set).length > 0) {
    await ctx.db.update('topics', { where: { id: input.id }, set });
  }

  return { ...existing, ...set } as Topic;
}

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

export const name = 'updateCollection';
export const description = 'Update a collection\'s title, description, pinned state, or smart query.';

export interface Input {
  id: string;
  title?: string;
  description?: string;
  pinned?: boolean;
  query?: unknown;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  kind: 'manual' | 'smart';
  query: unknown;
  pinned: boolean;
  articleCount: number;
  createdAt: string;
}

export type Output = Collection;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('collections', { where: { id: input.id } })) as Collection[];
  const existing = rows[0];
  if (!existing) {
    throw new HttpError(404, 'collection not found');
  }

  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description;
  if (input.pinned !== undefined) set.pinned = input.pinned;
  if (input.query !== undefined) set.query = input.query;

  await ctx.db.update('collections', { where: { id: input.id }, set });

  return { ...existing, ...set } as Collection;
}

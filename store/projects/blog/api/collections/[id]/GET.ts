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

export const name = 'getCollection';
export const description = 'Get a single collection by id, including its ordered article items.';

export interface Input {
  id: string;
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

export interface CollectionItem {
  id: string;
  collectionId: string;
  articleId: string;
  note: string;
  position: number;
  addedAt: string;
}

export type Output = Collection & { items: (CollectionItem & { article: unknown })[] };

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const collectionRows = (await ctx.db.query('collections', { where: { id: input.id } })) as Collection[];
  const collection = collectionRows[0];
  if (!collection) {
    throw new HttpError(404, 'collection not found');
  }

  const itemRows = (await ctx.db.query('collection_items', { where: { collectionId: input.id } })) as CollectionItem[];
  itemRows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const articles = (await ctx.db.query('articles')) as Row[];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const items = itemRows.map((item) => ({
    ...item,
    article: articleById.get(item.articleId) ?? null,
  }));

  return { ...collection, items };
}

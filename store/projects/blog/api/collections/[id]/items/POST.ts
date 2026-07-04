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

export const name = 'addToCollection';
export const description = 'File an article into a collection; deduped, and bumps the collection/article denormalized counts.';

export interface Input {
  id: string;
  articleId: string;
  note?: string;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  articleId: string;
  note: string;
  position: number;
  addedAt: string;
}

interface Collection {
  id: string;
  articleCount: number;
}

interface Article {
  id: string;
  collectionCount: number;
}

export type Output = CollectionItem;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const existingItems = (await ctx.db.query('collection_items', {
    where: { collectionId: input.id, articleId: input.articleId },
  })) as CollectionItem[];

  if (existingItems[0]) {
    return existingItems[0];
  }

  const created = (await ctx.db.insert('collection_items', {
    collectionId: input.id,
    articleId: input.articleId,
    note: input.note,
  })) as CollectionItem;

  const collectionRows = (await ctx.db.query('collections', { where: { id: input.id } })) as Collection[];
  const collection = collectionRows[0];
  if (collection) {
    await ctx.db.update('collections', {
      where: { id: collection.id },
      set: { articleCount: (collection.articleCount ?? 0) + 1 },
    });
  }

  const articleRows = (await ctx.db.query('articles', { where: { id: input.articleId } })) as Article[];
  const article = articleRows[0];
  if (article) {
    await ctx.db.update('articles', {
      where: { id: article.id },
      set: { collectionCount: (article.collectionCount ?? 0) + 1 },
    });
  }

  return created;
}

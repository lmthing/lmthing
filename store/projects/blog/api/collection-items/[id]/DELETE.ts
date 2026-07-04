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

export const name = 'removeCollectionItem';
export const description = 'Remove an article from a collection, decrementing the collection/article denormalized counts.';

export interface Input {
  id: string;
}

export interface Output {
  ok: boolean;
}

interface CollectionItem {
  id: string;
  collectionId: string;
  articleId: string;
}

interface Collection {
  id: string;
  articleCount: number;
}

interface Article {
  id: string;
  collectionCount: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const itemRows = (await ctx.db.query('collection_items', { where: { id: input.id } })) as CollectionItem[];
  const item = itemRows[0];

  if (!item) {
    return { ok: true };
  }

  await ctx.db.remove('collection_items', { where: { id: input.id } });

  const collectionRows = (await ctx.db.query('collections', { where: { id: item.collectionId } })) as Collection[];
  const collection = collectionRows[0];
  if (collection) {
    await ctx.db.update('collections', {
      where: { id: collection.id },
      set: { articleCount: Math.max(0, (collection.articleCount ?? 0) - 1) },
    });
  }

  const articleRows = (await ctx.db.query('articles', { where: { id: item.articleId } })) as Article[];
  const article = articleRows[0];
  if (article) {
    await ctx.db.update('articles', {
      where: { id: article.id },
      set: { collectionCount: Math.max(0, (article.collectionCount ?? 0) - 1) },
    });
  }

  return { ok: true };
}

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

export const name = 'getDigest';
export const description = 'Get a single digest by id, including its ordered items and their articles.';

export interface Input {
  id: string;
}

export interface Digest {
  id: string;
  title: string;
  summary: string;
  period: string;
  status: string;
  articleCount: number;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  imageUrl: string;
  score: number;
  read: boolean;
  saved: boolean;
  createdAt: string;
}

export interface DigestItem {
  id: string;
  digestId: string;
  articleId: string;
  topicSlug: string;
  position: number;
  blurb: string;
}

export type Output = Digest & { items: (DigestItem & { article: Article | null })[] };

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const digestRows = (await ctx.db.query('digests', { where: { id: input.id } })) as Digest[];
  const digest = digestRows[0];
  if (!digest) {
    throw new HttpError(404, 'digest not found');
  }

  const itemRows = (await ctx.db.query('digest_items', { where: { digestId: input.id } })) as DigestItem[];
  itemRows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const articles = (await ctx.db.query('articles')) as Article[];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const items = itemRows.map((item) => ({
    ...item,
    article: articleById.get(item.articleId) ?? null,
  }));

  return { ...digest, items };
}

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

export const name = 'getArticle';
export const description = 'Get a single article by id, including its citations.';

export interface Input {
  id: string;
}

interface Citation {
  id: string;
  articleId: string;
  rawItemId: string;
  quote: string;
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
  citations: Citation[];
}

export type Output = Article;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('articles', {
    where: { id: input.id },
    include: ['citations'],
  })) as Article[];

  const article = rows[0];
  if (!article) {
    throw new HttpError(404, 'article not found');
  }

  return article;
}

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

export const name = 'topicFeed';
export const description = "List articles tagged with a topic's slug, sorted by score then recency.";

export interface Input {
  id: string;
}

interface Topic {
  id: string;
  slug: string;
  label: string;
  followed: boolean;
  muted: boolean;
  weight: number;
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

export type Output = Article[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const topicRows = (await ctx.db.query('topics', { where: { id: input.id } })) as Topic[];
  const topic = topicRows[0];
  if (!topic) {
    throw new HttpError(404, 'topic not found');
  }

  const rows = (await ctx.db.query('articles')) as Article[];
  const articles = rows.filter((a) => Array.isArray(a.tags) && a.tags.includes(topic.slug));

  articles.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });

  return articles;
}

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

export const name = 'feedList';
export const description = 'List articles in the feed, optionally filtered by read/saved status or tag.';

export interface Input {
  unreadOnly?: boolean;
  savedOnly?: boolean;
  tag?: string;
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
  const rows = (await ctx.db.query('articles')) as Article[];

  let articles = rows;
  if (input.unreadOnly) {
    articles = articles.filter((a) => a.read !== true);
  }
  if (input.savedOnly) {
    articles = articles.filter((a) => a.saved === true);
  }
  if (input.tag) {
    const tag = input.tag;
    articles = articles.filter((a) => Array.isArray(a.tags) && a.tags.includes(tag));
  }

  articles.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });

  return articles;
}

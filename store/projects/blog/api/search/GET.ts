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

export const name = 'search';
export const description = 'Case-insensitive substring search across articles, briefings, and collections.';

export interface Input {
  q: string;
}

export interface Output {
  articles: unknown[];
  briefings: unknown[];
  collections: unknown[];
}

interface Article {
  id: string;
  title: string;
  summary: string;
  tags: string[];
}

interface Briefing {
  id: string;
  title: string;
  topic: string;
}

interface Collection {
  id: string;
  title: string;
  description: string;
}

const CAP = 20;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const q = (input.q ?? '').trim().toLowerCase();

  if (!q) {
    return { articles: [], briefings: [], collections: [] };
  }

  const articles = (await ctx.db.query('articles')) as Article[];
  const briefings = (await ctx.db.query('briefings')) as Briefing[];
  const collections = (await ctx.db.query('collections')) as Collection[];

  const matchedArticles = articles
    .filter((a) => {
      const tags = Array.isArray(a.tags) ? a.tags.join(' ') : '';
      return (
        (a.title ?? '').toLowerCase().includes(q) ||
        (a.summary ?? '').toLowerCase().includes(q) ||
        tags.toLowerCase().includes(q)
      );
    })
    .slice(0, CAP);

  const matchedBriefings = briefings
    .filter(
      (b) => (b.title ?? '').toLowerCase().includes(q) || (b.topic ?? '').toLowerCase().includes(q),
    )
    .slice(0, CAP);

  const matchedCollections = collections
    .filter(
      (c) => (c.title ?? '').toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    )
    .slice(0, CAP);

  return { articles: matchedArticles, briefings: matchedBriefings, collections: matchedCollections };
}

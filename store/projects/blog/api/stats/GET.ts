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

export const name = 'feedStats';
export const description = 'Compute feed summary stats: unread/saved/total article counts, source count, and top tags.';

export interface Input {}

interface Article {
  id: string;
  read: boolean;
  saved: boolean;
  tags: string[];
}

interface Source {
  id: string;
}

export interface Output {
  unread: number;
  saved: number;
  total: number;
  sources: number;
  tags: { tag: string; count: number }[];
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const articles = (await ctx.db.query('articles')) as Article[];
  const sources = (await ctx.db.query('sources')) as Source[];

  const unread = articles.filter((a) => a.read !== true).length;
  const saved = articles.filter((a) => a.saved === true).length;

  const tagCounts = new Map<string, number>();
  for (const a of articles) {
    if (!Array.isArray(a.tags)) continue;
    for (const tag of a.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    unread,
    saved,
    total: articles.length,
    sources: sources.length,
    tags,
  };
}

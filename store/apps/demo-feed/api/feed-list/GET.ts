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
export const description = 'List every item in the personal feed, newest first.';

export interface Input {}

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  read: boolean;
  createdAt: string;
}

export interface Output {
  items: FeedItem[];
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const items = (await ctx.db.query('feed_items', {
    orderBy: { column: 'createdAt', dir: 'desc' },
  })) as FeedItem[];
  return { items };
}

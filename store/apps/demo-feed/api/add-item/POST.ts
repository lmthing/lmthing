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

export const name = 'addItem';
export const description = 'Add a new item to the personal feed (lets the demo be exercised without a seed).';

export interface Input {
  title: string;
  url?: string;
  summary?: string;
}

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  read: boolean;
  createdAt: string;
}

export type Output = FeedItem;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const row = (await ctx.db.insert('feed_items', {
    title: input.title,
    url: input.url ?? '',
    summary: input.summary ?? '',
    read: false,
  })) as FeedItem;
  return row;
}

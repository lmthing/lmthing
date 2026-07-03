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

export const name = 'markAllRead';
export const description = 'Mark all unread articles as read, optionally scoped to a tag.';

export interface Input {
  tag?: string;
}

export interface Output {
  count: number;
}

interface Article {
  id: string;
  read: boolean;
  tags: string[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('articles')) as Article[];
  let unread = rows.filter((a) => a.read !== true);

  if (input.tag) {
    const tag = input.tag;
    unread = unread.filter((a) => Array.isArray(a.tags) && a.tags.includes(tag));
  }

  let count = 0;
  for (const a of unread) {
    const updated = await ctx.db.update('articles', {
      where: { id: a.id },
      set: { read: true },
    });
    count += updated;
  }

  return { count };
}

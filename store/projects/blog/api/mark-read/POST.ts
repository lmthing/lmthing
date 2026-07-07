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

export const name = 'markRead';
export const description = 'Mark a single article as read.';

export interface Input {
  id: string;
}

export interface Output {
  ok: boolean;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  // Read the article first so we can log a tagged engagement event exactly once —
  // on the unread→read transition — feeding the Insights timeline & personalization.
  const rows = (await ctx.db.query('articles', { where: { id: input.id } })) as {
    read?: boolean;
    tags?: string[];
  }[];
  const article = rows[0];
  const wasUnread = article ? article.read !== true : false;

  const count = await ctx.db.update('articles', {
    where: { id: input.id },
    set: { read: true },
  });

  if (wasUnread && count > 0) {
    const tags = Array.isArray(article?.tags) ? article!.tags : [];
    await ctx.db.insert('reading_events', {
      articleId: input.id,
      kind: 'open',
      tag: tags[0] ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  return { ok: count > 0 };
}

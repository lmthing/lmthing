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

export const name = 'logReadingEvent';
export const description = 'Log a reader-engagement event (open/save/dismiss/dwell) that drives feed personalization.';

export interface Input {
  articleId: string;
  kind: 'open' | 'save' | 'dismiss' | 'dwell';
  dwellMs?: number;
  tag?: string;
}

export interface Output {
  ok: boolean;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  await ctx.db.insert('reading_events', {
    articleId: input.articleId,
    kind: input.kind,
    dwellMs: input.dwellMs ?? 0,
    tag: input.tag,
  });

  return { ok: true };
}

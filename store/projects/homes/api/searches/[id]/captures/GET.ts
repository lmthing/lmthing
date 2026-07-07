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

export const name = 'listCaptures';
export const description = "List a search's raw captures, newest first.";

export interface Input {
  id: string;
}

export interface RawCapture {
  id: string;
  sourceId: string;
  searchId: string;
  content: string;
  sourceUrl?: string;
  status: string;
  summary?: string;
  error?: string;
  listingsFound: number;
  capturedAt: string;
}

export type Output = RawCapture[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const captures = (await ctx.db.query('raw_captures', {
    where: { searchId: input.id },
  })) as RawCapture[];

  captures.sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));

  return captures;
}

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

export const name = 'listCollections';
export const description = 'List all collections, pinned ones first, then newest first.';

export interface Input {}

export interface Collection {
  id: string;
  title: string;
  description: string;
  kind: 'manual' | 'smart';
  query: unknown;
  pinned: boolean;
  articleCount: number;
  createdAt: string;
}

export type Output = Collection[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const collections = (await ctx.db.query('collections')) as Collection[];

  return [...collections].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

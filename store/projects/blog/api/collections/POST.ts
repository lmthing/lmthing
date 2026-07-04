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

export const name = 'createCollection';
export const description = 'Create a new collection, either manual (hand-picked articles) or smart (query-derived).';

export interface Input {
  title: string;
  description?: string;
  kind?: 'manual' | 'smart';
  query?: unknown;
}

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

export type Output = Collection;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('collections', {
    title: input.title,
    description: input.description,
    kind: input.kind ?? 'manual',
    query: input.query,
  })) as Collection;

  return created;
}

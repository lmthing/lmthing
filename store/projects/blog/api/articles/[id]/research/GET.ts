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

export const name = 'getResearch';
export const description = 'List deep-research entries for an article, most recent first.';

export interface Input {
  id: string;
}

export interface Research {
  id: string;
  articleId: string;
  topic: string;
  body: string;
  status: 'pending' | 'ready' | 'error';
  createdAt: string;
}

export type Output = Research[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('research', {
    where: { articleId: input.id },
    orderBy: { column: 'createdAt', dir: 'desc' },
  })) as Research[];

  return rows;
}

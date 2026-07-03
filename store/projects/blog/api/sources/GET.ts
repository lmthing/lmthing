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

export const name = 'listSources';
export const description = 'List all configured sources, most recently added first.';

export interface Input {}

export interface Source {
  id: string;
  kind: string;
  value: string;
  label: string;
  topics: string[];
  active: boolean;
  lastFetchedAt: string;
  createdAt: string;
}

export type Output = Source[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('sources', {
    orderBy: { column: 'createdAt', dir: 'desc' },
  })) as Source[];

  return rows;
}

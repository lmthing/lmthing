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

export const name = 'listTopics';
export const description = 'List all followed/muted topics, sorted by personalization weight descending.';

export interface Input {}

export interface Topic {
  id: string;
  slug: string;
  label: string;
  followed: boolean;
  muted: boolean;
  weight: number;
  articleCount: number;
  createdAt: string;
}

export type Output = Topic[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('topics')) as Topic[];

  rows.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return rows;
}

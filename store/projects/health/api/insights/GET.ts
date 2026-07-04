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

export const name = 'listInsights';
export const description = 'List generated health insights, optionally filtered by kind, most recently created first.';

export interface Input {
  kind?: string;
}

export interface Insight {
  id: string;
  kind: string;
  body: string;
  metricKind?: string;
  createdAt: string;
}

export type Output = Insight[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('insights')) as Insight[];

  const filtered = input.kind ? rows.filter((r) => r.kind === input.kind) : rows;

  filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return filtered;
}

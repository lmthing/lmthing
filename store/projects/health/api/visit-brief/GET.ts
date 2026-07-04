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

export const name = 'listVisitBriefs';
export const description = 'List appointment prep briefs, most recently created first.';

export interface Input {}

export interface VisitBrief {
  id: string;
  title: string;
  body: string;
  status: string;
  periodFrom?: string;
  periodTo?: string;
  createdAt: string;
}

export type Output = VisitBrief[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('visit_briefs')) as VisitBrief[];

  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return rows;
}

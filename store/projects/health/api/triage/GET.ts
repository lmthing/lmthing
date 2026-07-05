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

export const name = 'listTriage';
export const description = 'List triage assessments, most recently requested first.';

export interface Input {}

export interface TriageAssessment {
  id: string;
  symptomId?: string;
  question: string;
  body?: string;
  urgency: string;
  status: string;
  createdAt: string;
}

export type Output = TriageAssessment[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('triage_assessments')) as TriageAssessment[];

  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return rows;
}

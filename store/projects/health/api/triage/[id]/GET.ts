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

import { HttpError } from '@app/runtime';

export const name = 'getTriage';
export const description = 'Get a triage assessment by id.';

export interface Input {
  id: string;
}

interface TriageAssessment {
  id: string;
  symptomId?: string;
  question: string;
  body?: string;
  urgency: string;
  status: string;
  createdAt: string;
}

export type Output = TriageAssessment;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('triage_assessments', { where: { id: input.id } })) as TriageAssessment[];

  const triage = rows[0];
  if (!triage) {
    throw new HttpError(404, 'triage assessment not found');
  }

  return triage;
}

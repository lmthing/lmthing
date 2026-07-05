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

export const name = 'requestTriage';
export const description = 'Request a conservative symptom-triage assessment. Free for all tiers — safety is never subscription-gated.';

export interface Input {
  question: string;
  symptomId?: string;
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

export interface Output {
  triageId: string;
  status: 'pending';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.question || !input.question.trim()) {
    throw new HttpError(400, 'question is required');
  }

  const created = (await ctx.db.insert('triage_assessments', {
    question: input.question,
    symptomId: input.symptomId,
    urgency: 'unknown',
    status: 'pending',
  })) as TriageAssessment;

  return { triageId: created.id, status: 'pending' };
}

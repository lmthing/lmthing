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

export const name = 'getLab';
export const description = 'Get a lab result by id, with its research deep-dives hydrated.';

export interface Input {
  id: string;
}

interface Research {
  id: string;
  labResultId?: string;
  symptomId?: string;
  topic: string;
  body?: string;
  status: string;
  createdAt: string;
}

interface LabResult {
  id: string;
  panel: string;
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  flag: string;
  takenAt: string;
  note?: string;
  research: Research[];
}

export type Output = LabResult;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('lab_results', {
    where: { id: input.id },
    include: ['research'],
  })) as LabResult[];

  const lab = rows[0];
  if (!lab) {
    throw new HttpError(404, 'lab result not found');
  }

  lab.research = lab.research ?? [];

  return lab;
}

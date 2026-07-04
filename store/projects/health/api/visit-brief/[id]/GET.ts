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

export const name = 'getVisitBrief';
export const description = 'Get an appointment prep brief by id.';

export interface Input {
  id: string;
}

interface VisitBrief {
  id: string;
  title: string;
  body: string;
  status: string;
  periodFrom?: string;
  periodTo?: string;
  createdAt: string;
}

export type Output = VisitBrief;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('visit_briefs', { where: { id: input.id } })) as VisitBrief[];

  const brief = rows[0];
  if (!brief) {
    throw new HttpError(404, 'visit brief not found');
  }

  return brief;
}

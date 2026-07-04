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

export const name = 'getResearch';
export const description = 'Get a research report by id.';

export interface Input {
  id: string;
}

export interface Research {
  id: string;
  labResultId?: string;
  symptomId?: string;
  topic: string;
  body?: string;
  status: string;
  createdAt: string;
}

export type Output = Research;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('research', { where: { id: input.id } })) as Research[];

  const research = rows[0];
  if (!research) {
    throw new HttpError(404, 'research not found');
  }

  return research;
}

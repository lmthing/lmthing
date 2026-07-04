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

export const name = 'getBriefing';
export const description = 'Get a single research briefing by id.';

export interface Input {
  id: string;
}

export interface Briefing {
  id: string;
  title: string;
  topic: string;
  body: string;
  status: 'pending' | 'ready' | 'error';
  collectionId: string | null;
  sourceCount: number;
  createdAt: string;
}

export type Output = Briefing;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('briefings', { where: { id: input.id } })) as Briefing[];
  const briefing = rows[0];
  if (!briefing) {
    throw new HttpError(404, 'briefing not found');
  }

  return briefing;
}

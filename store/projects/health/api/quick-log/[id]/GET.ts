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

export const name = 'getQuickLogDraft';
export const description =
  'Fetch a quick-log draft by id so the client can poll for the logger\'s parsed proposedActions before confirming.';

export interface Input {
  id: string;
}

/** One proposed write the logger parsed out of the note. */
export interface ProposedAction {
  table: 'metrics' | 'symptoms' | 'medications' | 'adherence_logs';
  values: Record<string, unknown>;
  summary: string;
}

export interface Output {
  id: string;
  text: string;
  status: string;
  proposedActions: ProposedAction[];
  note?: string;
  createdAt: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('quicklog_drafts', { where: { id: input.id } })) as Output[];
  const row = rows[0];
  if (!row) throw new HttpError(404, 'draft not found');
  return {
    ...row,
    proposedActions: Array.isArray(row.proposedActions) ? row.proposedActions : [],
  };
}

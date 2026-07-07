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

export const name = 'quickLog';
export const description =
  'Submit a natural-language health note (e.g. "slept 6.5h, weight 82kg, took atorvastatin, mild headache since lunch"). The logger parses it into a reviewable set of proposed writes; nothing is written until the user confirms via commitQuickLog.';

export interface Input {
  text: string;
}

interface Draft {
  id: string;
  text: string;
  status: string;
}

export interface Output {
  draftId: string;
  status: 'pending';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.text || !input.text.trim()) {
    throw new HttpError(400, 'text is required');
  }
  if (input.text.length > 2000) {
    throw new HttpError(400, 'note too long (max 2000 chars)');
  }

  // Insert a pending draft — the parse-quicklog hook fires the logger to fill in
  // proposedActions. This is a "reconcile now" signal; the logger self-queries
  // pending drafts. Nothing lands in the real tables here (confirm-before-write).
  const created = (await ctx.db.insert('quicklog_drafts', {
    text: input.text.trim(),
    status: 'pending',
  })) as Draft;

  return { draftId: created.id, status: 'pending' };
}

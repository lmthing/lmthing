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

export const name = 'commitQuickLog';
export const description =
  'Apply a parsed quick-log draft to the real tables AFTER the user has reviewed it (confirm-before-write). Accepts an optional subset of action indices the user kept; anything else is discarded.';

export interface Input {
  draftId: string;
  /** Indices into the draft.proposedActions the user confirmed. Omit to commit all. */
  acceptedIndices?: number[];
}

export interface Output {
  written: number;
  tables: string[];
}

// Only low-risk, user-authored tables may be written from a quick-log. Clinical,
// AI-authored tables (lab_results.flag, interactions, research, …) are never
// written here — those stay single-author via their specialist + hook pipeline.
const ALLOWED = new Set(['metrics', 'symptoms', 'medications', 'adherence_logs']);

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('quicklog_drafts', { where: { id: input.draftId } })) as Row[];
  const draft = rows[0];
  if (!draft) throw new HttpError(404, 'draft not found');
  if (draft.status === 'committed') throw new HttpError(409, 'draft already committed');
  if (draft.status !== 'ready') throw new HttpError(409, 'draft is not ready to commit yet');

  const actions = Array.isArray(draft.proposedActions)
    ? (draft.proposedActions as { table: string; values: Record<string, unknown> }[])
    : [];

  const kept =
    input.acceptedIndices && input.acceptedIndices.length > 0
      ? actions.filter((_, i) => input.acceptedIndices!.includes(i))
      : actions;

  const tablesTouched = new Set<string>();
  let written = 0;

  for (const action of kept) {
    if (!action || !ALLOWED.has(action.table)) continue;
    const values = { ...(action.values ?? {}) };
    // Never let a quick-log set a lab flag or a computed clinical field.
    delete (values as Record<string, unknown>).flag;
    await ctx.db.insert(action.table, values);
    tablesTouched.add(action.table);
    written += 1;
  }

  await ctx.db.update('quicklog_drafts', {
    where: { id: input.draftId },
    set: { status: 'committed' },
  });

  return { written, tables: [...tablesTouched] };
}

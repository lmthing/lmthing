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

export const name = 'listDoses';
export const description = 'List medication doses, most recently scheduled first, optionally filtered to a medication or to doses still due.';

export interface Input {
  medicationId?: string;
  dueOnly?: boolean;
}

export interface AdherenceLog {
  id: string;
  medicationId: string;
  scheduledAt: string;
  takenAt?: string;
  status: string;
  note?: string;
}

export type Output = AdherenceLog[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('adherence_logs', {
    where: input.medicationId ? { medicationId: input.medicationId } : undefined,
  })) as AdherenceLog[];

  let result = rows;
  if (input.dueOnly) {
    result = result.filter((r) => r.status !== 'taken');
  }

  result.sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));

  return result;
}

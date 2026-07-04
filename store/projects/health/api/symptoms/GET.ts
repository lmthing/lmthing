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

export const name = 'listSymptoms';
export const description = 'List logged symptoms; active (ongoing) symptoms are sorted first, then by most recently started.';

export interface Input {}

export interface Symptom {
  id: string;
  name: string;
  severity: number;
  startedAt: string;
  endedAt?: string;
  note?: string;
}

export type Output = Symptom[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('symptoms')) as Symptom[];

  rows.sort((a, b) => {
    const aActive = a.endedAt == null;
    const bActive = b.endedAt == null;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return (b.startedAt ?? '').localeCompare(a.startedAt ?? '');
  });

  return rows;
}

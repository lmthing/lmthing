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

export const name = 'listMedications';
export const description = 'List medications, most recently started first.';

export interface Input {}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  schedule?: string;
  startedAt: string;
  endedAt?: string;
  note?: string;
}

export type Output = Medication[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('medications')) as Medication[];

  rows.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));

  return rows;
}

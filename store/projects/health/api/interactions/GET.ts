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

export const name = 'listInteractions';
export const description = 'List interaction findings, most recently requested first, optionally filtered to a medication.';

export interface Input {
  medicationId?: string;
}

export interface Interaction {
  id: string;
  medicationId: string;
  otherName: string;
  severity: string;
  body?: string;
  status: string;
  createdAt: string;
}

export type Output = Interaction[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('interactions', {
    where: input.medicationId ? { medicationId: input.medicationId } : undefined,
  })) as Interaction[];

  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return rows;
}

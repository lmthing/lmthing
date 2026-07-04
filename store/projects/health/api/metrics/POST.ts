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

export const name = 'logMetric';
export const description = 'Log a new health metric measurement (weight, sleep hours, blood pressure, steps, resting heart rate, etc).';

export interface Input {
  kind: string;
  value: number;
  unit: string;
  recordedAt?: string;
  source?: string;
  note?: string;
}

export interface Metric {
  id: string;
  kind: string;
  value: number;
  unit: string;
  recordedAt: string;
  source?: string;
  note?: string;
}

export type Output = Metric;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('metrics', {
    kind: input.kind,
    value: input.value,
    unit: input.unit,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    source: input.source,
    note: input.note,
  })) as Metric;

  return created;
}

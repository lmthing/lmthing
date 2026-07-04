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

export const name = 'listMetrics';
export const description = 'List logged health metrics, optionally filtered by kind and/or a recordedAt date range, sorted ascending by recordedAt.';

export interface Input {
  kind?: string;
  from?: string;
  to?: string;
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

export type Output = Metric[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('metrics')) as Metric[];

  const filtered = rows.filter((m) => {
    if (input.kind && m.kind !== input.kind) return false;
    if (input.from && (m.recordedAt ?? '') < input.from) return false;
    if (input.to && (m.recordedAt ?? '') > input.to) return false;
    return true;
  });

  filtered.sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));

  return filtered;
}

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

export const name = 'importMetrics';
export const description = 'Bulk-import health metrics from an Apple Health, Google Fit, or raw CSV export. Expects CSV rows of kind,value,unit,recordedAt; rows already present (same kind + recordedAt) are skipped.';

export interface Input {
  format: 'apple' | 'google' | 'csv';
  payload: string;
}

interface Metric {
  id: string;
  kind: string;
  value: number;
  unit: string;
  recordedAt: string;
  source?: string;
}

export interface Output {
  imported: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const lines = input.payload.split('\n');

  const parsed: Row[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (idx === 0 && trimmed.toLowerCase().includes('kind')) return;

    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 4) return;

    const [kind, value, unit, recordedAt] = parts;
    if (!kind || !recordedAt) return;

    const numValue = Number(value);
    if (Number.isNaN(numValue)) return;

    parsed.push({
      kind,
      value: numValue,
      unit,
      recordedAt,
      source: input.format,
    });
  });

  if (parsed.length === 0) {
    return { imported: 0 };
  }

  const existing = (await ctx.db.query('metrics')) as Metric[];
  const existingKeys = new Set(existing.map((m) => `${m.kind}|${m.recordedAt}`));

  const newRows = parsed.filter((r) => !existingKeys.has(`${r.kind}|${r.recordedAt}`));

  if (newRows.length === 0) {
    return { imported: 0 };
  }

  await ctx.db.insert('metrics', newRows);

  return { imported: newRows.length };
}

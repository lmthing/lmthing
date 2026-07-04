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

export const name = 'listLabs';
export const description = 'List lab results, optionally filtered by panel; flagged (abnormal) results are sorted first, then by most recently taken.';

export interface Input {
  panel?: string;
}

export interface LabResult {
  id: string;
  panel: string;
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  flag: string;
  takenAt: string;
  note?: string;
}

export type Output = LabResult[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('lab_results')) as LabResult[];

  const filtered = input.panel ? rows.filter((r) => r.panel === input.panel) : rows;

  filtered.sort((a, b) => {
    const aFlagged = a.flag !== 'normal';
    const bFlagged = b.flag !== 'normal';
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    return (b.takenAt ?? '').localeCompare(a.takenAt ?? '');
  });

  return filtered;
}

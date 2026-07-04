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

export const name = 'addLab';
export const description = 'Add a new lab result. The flag (low/normal/high) is set by the interpreter hook, never by user input.';

export interface Input {
  panel: string;
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  takenAt: string;
  note?: string;
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

export type Output = LabResult;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('lab_results', {
    panel: input.panel,
    analyte: input.analyte,
    value: input.value,
    unit: input.unit,
    refLow: input.refLow,
    refHigh: input.refHigh,
    flag: 'normal',
    takenAt: input.takenAt,
    note: input.note,
  })) as LabResult;

  return created;
}

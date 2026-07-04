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

export const name = 'addMedication';
export const description = 'Add a medication to the current regimen.';

export interface Input {
  name: string;
  dose?: string;
  schedule?: string;
  startedAt: string;
  note?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  schedule?: string;
  startedAt: string;
  endedAt?: string;
  note?: string;
}

export type Output = Medication;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('medications', {
    name: input.name,
    dose: input.dose,
    schedule: input.schedule,
    startedAt: input.startedAt,
    note: input.note,
  })) as Medication;

  return created;
}

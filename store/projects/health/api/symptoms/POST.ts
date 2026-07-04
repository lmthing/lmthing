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

export const name = 'logSymptom';
export const description = 'Log a new symptom episode.';

export interface Input {
  name: string;
  severity?: number;
  startedAt: string;
  endedAt?: string;
  note?: string;
}

export interface Symptom {
  id: string;
  name: string;
  severity: number;
  startedAt: string;
  endedAt?: string;
  note?: string;
}

export type Output = Symptom;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('symptoms', {
    name: input.name,
    severity: input.severity ?? 1,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    note: input.note,
  })) as Symptom;

  return created;
}

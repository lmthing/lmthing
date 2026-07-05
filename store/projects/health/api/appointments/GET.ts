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

export const name = 'listAppointments';
export const description = 'List appointments, soonest first, optionally filtered to upcoming scheduled ones.';

export interface Input {
  upcomingOnly?: boolean;
}

export interface Appointment {
  id: string;
  title: string;
  provider?: string;
  location?: string;
  kind: string;
  scheduledAt: string;
  status: string;
  prepBriefId?: string;
  note?: string;
  createdAt: string;
}

export type Output = Appointment[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('appointments')) as Appointment[];

  let result = rows;
  if (input.upcomingOnly) {
    const now = new Date().toISOString();
    result = result.filter((a) => a.scheduledAt >= now && a.status === 'scheduled');
  }

  result.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));

  return result;
}

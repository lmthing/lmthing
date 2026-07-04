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

export const name = 'prepareVisit';
export const description = 'Kick off preparation of an appointment prep brief summarizing recent labs, symptoms, and metrics. Fires the prepare-visit-brief hook.';

export interface Input {
  title?: string;
  since?: string;
}

export interface VisitBrief {
  id: string;
  title: string;
  body: string;
  status: string;
  periodFrom?: string;
  periodTo?: string;
  createdAt: string;
}

export type Output = { visitBriefId: string; status: 'pending' };

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('visit_briefs', {
    title: input.title ?? 'Appointment prep brief',
    status: 'pending',
    periodFrom: input.since,
  })) as VisitBrief;

  return { visitBriefId: created.id, status: 'pending' };
}

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

export const name = 'planTransit';
export const description = 'Kick off the logistics navigator agent to (re)plan transit legs for a trip.';

export interface Input {
  id: string;
}

export interface Output {
  ok: true;
  runId: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  // Seed a pending run; the `dispatch-agent-run` hook (agent_runs insert) maps kind
  // 'transit' → logistics/navigator#plan-transit and runs it. (ctx.spawn is a no-op
  // stub in the pod runtime, so an endpoint must never rely on it to start an agent.)
  const run = (await ctx.db.insert('agent_runs', {
    tripId: input.id,
    kind: 'transit',
    label: 'Planning transit',
    status: 'running',
    detail: 'Sequencing the legs between your destinations…',
  })) as { id: string };
  return { ok: true, runId: run.id };
}

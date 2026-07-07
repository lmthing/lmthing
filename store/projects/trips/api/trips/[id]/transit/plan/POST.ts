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
  const run = (await ctx.db.insert('agent_runs', {
    tripId: input.id,
    kind: 'transit',
    label: 'Planning transit',
    status: 'running',
    detail: 'Sequencing the legs between your destinations…',
  })) as { id: string };
  const { runId } = await ctx.spawn('logistics/navigator#plan-transit', { tripId: input.id }, {
    onError: async () => {
      await ctx.db.update('agent_runs', {
        where: { id: run.id },
        set: { status: 'error', detail: 'Transit planning failed.', endedAt: new Date().toISOString() },
      });
    },
  });
  return { ok: true, runId };
}

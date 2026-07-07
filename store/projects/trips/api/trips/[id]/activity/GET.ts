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

export const name = 'getTripActivity';
export const description =
  'Recent background agent runs for a trip (planning, deals, packing, transit, research). Powers the live RunStrip. Reconciles stale "running" rows to "done" once the work has landed or after a timeout.';

export interface Input {
  id: string;
}

export interface AgentRun {
  id: string;
  tripId: string;
  kind: string;
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  startedAt: string;
  endedAt?: string;
}

export interface Output {
  runs: AgentRun[];
  runningCount: number;
}

const STALE_MS = 20 * 60 * 1000;

async function landed(db: Db, kind: string, tripId: string, destIds: string[]): Promise<boolean> {
  try {
    if (kind === 'plan') {
      for (const destinationId of destIds) {
        const items = await db.query('itinerary_items', { where: { destinationId }, limit: 1 });
        if (items.length) return true;
      }
      return false;
    }
    if (kind === 'deals') return (await db.query('deals', { where: { tripId }, limit: 1 })).length > 0;
    if (kind === 'packing') return (await db.query('packing_items', { where: { tripId }, limit: 1 })).length > 0;
    if (kind === 'transit') return (await db.query('transit_legs', { where: { tripId }, limit: 1 })).length > 0;
    if (kind === 'research') return (await db.query('research', { where: { tripId }, limit: 1 })).length > 0;
  } catch {
    // Best-effort reconciliation only.
  }
  return false;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const runs = (await ctx.db.query('agent_runs', {
    where: { tripId: input.id },
    orderBy: { column: 'startedAt', dir: 'desc' },
    limit: 20,
  })) as unknown as AgentRun[];

  const dests = (await ctx.db.query('destinations', { where: { tripId: input.id } })) as Array<{ id: string }>;
  const destIds = dests.map((d) => d.id);
  const now = Date.now();

  for (const run of runs) {
    if (run.status !== 'running') continue;
    const startedMs = run.startedAt ? Date.parse(run.startedAt) : now;
    const isStale = Number.isFinite(startedMs) && now - startedMs > STALE_MS;
    const done = await landed(ctx.db, run.kind, input.id, destIds);
    if (done || isStale) {
      const endedAt = new Date().toISOString();
      await ctx.db.update('agent_runs', {
        where: { id: run.id },
        set: { status: 'done', endedAt },
      });
      run.status = 'done';
      run.endedAt = endedAt;
    }
  }

  return { runs, runningCount: runs.filter((r) => r.status === 'running').length };
}

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

export const name = 'createTrip';
export const description = "Create a new trip and kick off the concierge's planning run for it.";

export interface Input {
  title: string;
  brief: string;
  startDate?: string;
  endDate?: string;
  budgetUsd?: number;
}

export interface Output {
  tripId: string;
  status: 'planning';
}

interface Trip {
  id: string;
  title: string;
  brief: string;
  startDate?: string;
  endDate?: string;
  status: string;
  budgetUsd: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trip = (await ctx.db.insert('trips', {
    title: input.title,
    brief: input.brief,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'planning',
    budgetUsd: input.budgetUsd ?? 0,
  })) as Trip;

  // Record a visible "running" run. Inserting this agent_runs row is what actually
  // kicks off planning: the `dispatch-agent-run` database:insert hook maps kind
  // 'plan' → concierge/planner#plan-trip and delegates to it (an api handler's
  // ctx.spawn is a no-op stub in the pod runtime, so we must NOT rely on it). The
  // RunStrip on Overview/Timeline shows this row; getTripActivity + the hook
  // reconcile it to 'done'/'error'.
  await ctx.db.insert('agent_runs', {
    tripId: trip.id,
    kind: 'plan',
    label: 'Planning your trip',
    status: 'running',
    detail: 'Proposing destinations and laying out the days…',
  });

  return { tripId: trip.id, status: 'planning' };
}

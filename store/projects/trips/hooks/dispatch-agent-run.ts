// Dispatch a background specialist run from a freshly-inserted `agent_runs` row.
//
// User actions (create a trip, "find deals", "generate packing", "plan transit")
// cannot start an agent via an api handler's `ctx.spawn` — that is a no-op stub in
// the pod runtime (`[app-api] spawn(...) deferred`), so the run would sit in
// `status:'running'` forever. Instead each of those endpoints just SEEDS a pending
// `agent_runs` row, and this event hook (subscribing to the synthetic
// `project/db.agent_runs.insert` write event) is the one working path that
// actually runs the agent: it maps the row's `kind` → the specialist `agent#action`
// and `delegate`s to it (the same mechanism the split/reconcile/research hooks use).
//
// Idempotent: only acts on a fresh `status:'running'` row of a known kind, and marks
// the row `done`/`error` when the delegate settles (getTripActivity also reconciles
// `running`→`done` once the work lands, as a backstop).

interface AgentRunRow {
  id: string;
  tripId?: string;
  kind?: string;
  status?: string;
}

// kind → the specialist space/agent + action that fulfils it. `tripId` is the only
// input every one of these actions needs (they self-scan the trip from there).
const DISPATCH: Record<string, { space: string; action: string }> = {
  plan: { space: 'concierge/planner', action: 'plan-trip' },
  deals: { space: 'finance/deal-hunter', action: 'hunt' },
  packing: { space: 'logistics/packer', action: 'pack' },
  transit: { space: 'logistics/navigator', action: 'plan-transit' },
};

interface DelegateResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  sessionId?: string;
}

export default {
  type: 'event',
  on: { event: 'project/db.agent_runs.insert' },
  // Planning is by far the heaviest run — propose destinations, a web-research fan-out
  // over each (many searches), THEN lay out the days. The lay-out must not starve on
  // episode budget after research, so budget generously.
  budget: { maxEpisodes: 150, maxWallClockMs: 900000 },
  handler: async ({
    input,
    db,
    delegate,
  }: {
    input: AgentRunRow;
    db: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<DelegateResult>;
  }) => {
    if (!input || input.status !== 'running') return; // only fresh, pending runs
    const target = DISPATCH[String(input.kind)];
    if (!target) return; // unknown kind — nothing to dispatch (idempotent no-op)
    const markError = () =>
      db.update('agent_runs', {
        where: { id: input.id },
        set: { status: 'error', detail: 'Background run failed — try again.', endedAt: new Date().toISOString() },
      });
    try {
      // `delegate` no longer throws on an agent failure — it returns { ok:false }.
      const res = await delegate(target.space, target.action, { input: { tripId: input.tripId } });
      if (res && res.ok === false) {
        await markError();
        return;
      }
      await db.update('agent_runs', {
        where: { id: input.id },
        set: { status: 'done', endedAt: new Date().toISOString() },
      });
    } catch {
      await markError();
    }
  },
};

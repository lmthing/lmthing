// hooks/generate-briefing.ts — fires when a `briefings` row is inserted (the `requestBriefing`
// API pre-seeds a `pending` row for the analyst to fill). Subscribes to the synthetic db event
// `project/db.briefings.insert`; `ctx.input` IS the written row.
export default {
  type: 'event',
  on: { event: 'project/db.briefings.insert' },
  // A briefing survey does a live webSearch + a couple of webFetches then a write — give it real
  // headroom (a tight 10-episode cap starves the survey mid-fetch and forces an honest-but-empty
  // error briefing).
  budget: { maxEpisodes: 30, maxWallClockMs: 600000 },
  handler: async ({
    input,
    delegate,
  }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // Skip a row that's already been filled in (has a body) or isn't `pending` (idempotence /
    // loop guard — the `write` step's own update back to this same row does not re-trigger an
    // insert). The analyst also self-queries the oldest pending briefing, so passing the id is a
    // hint; the structured `input` is now delivered to the delegated agent.
    if (input && (input.body || input.status !== 'pending')) return;
    await delegate('research/analyst', 'brief', { input: { briefingId: input?.id } });
  },
};

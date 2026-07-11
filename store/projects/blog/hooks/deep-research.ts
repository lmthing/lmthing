// hooks/deep-research.ts — fires when a `research` row is inserted (the `requestResearch` API
// pre-seeds a `pending` row for the researcher to fill). Like `generate-briefing`/`generate-take`,
// this event hook on `project/db.research.insert` is the working trigger path — the app-API
// `ctx.spawn` seam is a no-op in the pod runtime, so a hook is what actually runs the researcher's
// `deep-dive` tasklist (`ctx.input` IS the written row). The researcher also self-queries the
// oldest pending research row; the passed id is a hint.
export default {
  type: 'event',
  on: { event: 'project/db.research.insert' },
  // A deep dive does live webSearch + several webFetches before it writes — give it real headroom
  // (mirrors generate-briefing; a tight cap starves the survey mid-fetch and forces an empty report).
  budget: { maxEpisodes: 30, maxWallClockMs: 600000 },
  handler: async ({
    input,
    delegate,
  }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // Skip a row that's already filled (has a body) or isn't `pending` (idempotence / loop guard —
    // the researcher's own `update`/`write` back is not an `insert`, so it does not re-trigger this
    // hook).
    if (input && (input.body || input.status !== 'pending')) return;
    await delegate('newsroom/researcher', 'deep-dive', { input: { researchId: input?.id } });
  },
};

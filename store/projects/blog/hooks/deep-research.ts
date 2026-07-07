// hooks/deep-research.ts — fires when a `research` row is inserted (the `requestResearch` API
// pre-seeds a `pending` row for the researcher to fill). Like `generate-briefing`/`generate-take`,
// this `database:insert` hook is the working trigger path — the app-API `ctx.spawn` seam is a no-op
// in the pod runtime, so a hook is what actually runs the researcher's `deep-dive` tasklist.
// Structured input is dropped across the hook boundary, so the researcher self-queries the oldest
// pending research row rather than trusting a passed id (`row` is a hint only).
export default {
  type: 'database',
  on: { table: 'research', event: 'insert' },
  // A deep dive does live webSearch + several webFetches before it writes — give it real headroom
  // (mirrors generate-briefing; a tight cap starves the survey mid-fetch and forces an empty report).
  budget: { maxEpisodes: 30, maxWallClockMs: 600000 },
  handler: async ({
    row,
    delegate,
  }: {
    row: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // `row` is absent on a manual/boot run — the researcher self-queries the oldest pending row
    // either way, so still delegate. Skip a row that's already filled (has a body) or isn't
    // `pending` (idempotence / loop guard — the researcher's own `update`/`write` back is not an
    // `insert`, so it does not re-trigger this hook).
    if (row && (row.body || row.status !== 'pending')) return;
    await delegate('newsroom/researcher', 'deep-dive', { input: { researchId: row?.id } });
  },
};

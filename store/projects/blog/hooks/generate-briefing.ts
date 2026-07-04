// hooks/generate-briefing.ts — fires when a `briefings` row is inserted (the `requestBriefing`
// API pre-seeds a `pending` row for the analyst to fill). Structured input is dropped across the
// hook boundary, so the analyst self-queries the oldest pending briefing rather than trusting a
// passed id — `row` is a hint only.
export default {
  type: 'database',
  on: { table: 'briefings', event: 'insert' },
  // A briefing survey does a live webSearch + a couple of webFetches then a write — give it real
  // headroom (a tight 10-episode cap starves the survey mid-fetch and forces an honest-but-empty
  // error briefing).
  budget: { maxEpisodes: 30, maxWallClockMs: 600000 },
  handler: async ({
    row,
    delegate,
  }: {
    row: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // `row` is absent on a manual/boot/cron run of this hook — the analyst self-queries the oldest
    // pending briefing either way, so still delegate in that case. Skip a row that's already been
    // filled in (has a body) or isn't `pending` (idempotence / loop guard — the `write` step's own
    // update back to this same row does not re-trigger an insert).
    if (row && (row.body || row.status !== 'pending')) return;
    await delegate('research/analyst', 'brief', { input: { briefingId: row?.id } });
  },
};

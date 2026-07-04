// hooks/personalize-on-read.ts — learn from the newest engagement signal.
// Fires on each reading_events insert (coalesced per-hook, so a burst learns once per window).
// The personalizer nudges topic weights from the event; a subsequent topics:update then fires
// `rescore-on-topic-change` once (different hook, within the depth cap) — the cascade stops at
// articles (no article hook).
export default {
  type: 'database',
  on: { table: 'reading_events', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({
    row,
    delegate,
  }: {
    row: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // Structured input is not delivered across the hook boundary and events coalesce, so the
    // personalizer self-queries the most recent engagement — `row` is a hint only.
    await delegate('editorial/personalizer', 'learn', { input: { eventId: row?.id } });
  },
};

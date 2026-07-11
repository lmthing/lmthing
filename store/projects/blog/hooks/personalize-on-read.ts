// hooks/personalize-on-read.ts — learn from the newest engagement signal.
// Fires on each reading_events insert (`project/db.reading_events.insert`; `ctx.input` IS the
// written row; coalesced per-hook, so a burst learns once per window). The personalizer nudges
// topic weights from the event; a subsequent topics:update then fires `rescore-on-topic-change`
// once (different hook, within the depth cap) — the cascade stops at articles (no article hook).
export default {
  type: 'event',
  on: { event: 'project/db.reading_events.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({
    input,
    delegate,
  }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // Events coalesce, so the personalizer self-queries the most recent engagement; the passed
    // `input` (the written row) is delivered as a hint.
    await delegate('editorial/personalizer', 'learn', { input: { eventId: input?.id } });
  },
};

// hooks/synthesize-new.ts — fires when a `raw_items` row is inserted (`project/db.raw_items.insert`;
// `ctx.input` IS the written row). The synthesizer self-queries unprocessed items; the passed id is
// a hint.
export default {
  type: 'event',
  on: { event: 'project/db.raw_items.insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ input, delegate }: { input: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Skip an already-processed row (idempotence — loop guard also excludes self-writes).
    if (input && input.processed) return;
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: input?.id } });
  },
};

export default {
  type: 'database',
  on: { table: 'raw_items', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, delegate }: { row: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // `row` is absent on a manual/boot run — the synthesizer self-queries unprocessed items, so
    // still delegate in that case; on an auto-dispatch, skip an already-processed row.
    if (row && row.processed) return; // idempotence (loop guard also excludes self-writes)
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: row?.id } });
  },
};

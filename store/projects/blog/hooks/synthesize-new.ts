export default {
  type: 'database',
  on: { table: 'raw_items', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, delegate }: { row: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    if (row.processed) return; // idempotence (loop guard also excludes self-writes)
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: row.id } });
  },
};

export default {
  type: 'database',
  on: { table: 'taste_signals', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Already folded into taste_notes (or inserted pre-folded) — nothing to learn.
    if (row.folded) return;
    await delegate('scout/ranker', 'learn', { input: { searchId: row.searchId } });
  },
};

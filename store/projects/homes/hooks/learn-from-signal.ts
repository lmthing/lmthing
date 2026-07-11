export default {
  type: 'event',
  on: { event: 'project/db.taste_signals.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<{ ok: boolean; result?: unknown; error?: string; sessionId?: string }> }) => {
    // Already folded into taste_notes (or inserted pre-folded) — nothing to learn.
    if (input.folded) return;
    await delegate('scout/ranker', 'learn', { input: { searchId: input.searchId } });
  },
};

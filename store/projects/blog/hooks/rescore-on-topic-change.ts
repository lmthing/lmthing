// hooks/rescore-on-topic-change.ts — re-rank the feed after a topic weight changes.
// Fires when a topics row is updated (a weight/mute change, whether by the reader via
// updateTopic or by the personalizer's `learn`). The personalizer re-scores every article by
// the current topic weights. Writes land on articles.score, which has no hook, so the cascade
// terminates (depth cap 3 is never approached).
export default {
  type: 'database',
  on: { table: 'topics', event: 'update' },
  budget: { maxEpisodes: 6 },
  handler: async ({
    delegate,
  }: {
    delegate: (ref: string, action: string, opts?: { input?: unknown }) => Promise<unknown>;
  }) => {
    await delegate('editorial/personalizer', 'rescore', {});
  },
};

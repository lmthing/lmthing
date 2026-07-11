// hooks/file-into-collections.ts — fires whenever a new `articles` row is inserted (the newsroom
// synthesizer just wrote it up). Subscribes to `project/db.articles.insert`; `ctx.input` IS the
// written row. The librarian self-queries recently-synthesized articles and matches them against
// every smart collection's saved query; the passed `input` id is a hint.
// Loop guard: articles:insert -> file -> writes collection_items rows (no hook on that table) and
// bumps collections.articleCount/articles.collectionCount, neither of which re-triggers this hook.
export default {
  type: 'event',
  on: { event: 'project/db.articles.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({
    input,
    delegate,
  }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    await delegate('research/librarian', 'file', { input: { articleId: input?.id } });
  },
};

// hooks/file-into-collections.ts — fires whenever a new `articles` row is inserted (the newsroom
// synthesizer just wrote it up). Structured input is dropped across the hook boundary, so the
// librarian self-queries recently-synthesized articles and matches them against every smart
// collection's saved query — `row` is a hint only.
// Loop guard: articles:insert -> file -> writes collection_items rows (no hook on that table) and
// bumps collections.articleCount/articles.collectionCount, neither of which re-triggers this hook.
export default {
  type: 'database',
  on: { table: 'articles', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({
    row,
    delegate,
  }: {
    row: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // `row` is absent on a manual/boot/cron run — the librarian self-queries recently-synthesized
    // articles either way, so still delegate.
    await delegate('research/librarian', 'file', { input: { articleId: row?.id } });
  },
};

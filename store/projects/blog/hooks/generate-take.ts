// hooks/generate-take.ts — fires when an `article_takes` row is inserted (the `requestTake`
// API pre-seeds a `pending` row for the explainer to fill). This is the one working trigger
// path for a user-initiated agent run: the app-API `ctx.spawn` seam is a no-op in the pod
// runtime, so — exactly like `generate-briefing` drives the analyst — a `database:insert` hook
// is what actually runs the explainer. Structured input is dropped across the hook boundary,
// so the explainer self-queries the oldest pending take rather than trusting a passed id
// (`row` is a hint only).
export default {
  type: 'database',
  on: { table: 'article_takes', event: 'insert' },
  // A take is a short, cached reframing of one already-synthesized article (no web I/O), so a
  // tight episode cap is plenty — it keeps a burst of TL;DR/ELI5/why-me requests cheap.
  budget: { maxEpisodes: 8 },
  handler: async ({
    row,
    delegate,
  }: {
    row: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // `row` is absent on a manual/boot/cron run of this hook — the explainer self-queries the
    // oldest pending take either way, so still delegate in that case. Skip a row that has already
    // been filled (has a body) or isn't `pending` (idempotence / loop guard — the explainer's own
    // update back to this same row is a `write`, not an `insert`, so it does not re-trigger this).
    if (row && (row.body || row.status !== 'pending')) return;
    await delegate('editorial/explainer', 'explain', { input: { takeId: row?.id } });
  },
};

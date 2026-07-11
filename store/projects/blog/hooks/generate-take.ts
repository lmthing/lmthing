// hooks/generate-take.ts — fires when an `article_takes` row is inserted (the `requestTake`
// API pre-seeds a `pending` row for the explainer to fill). This is the one working trigger
// path for a user-initiated agent run: the app-API `ctx.spawn` seam is a no-op in the pod
// runtime, so — exactly like `generate-briefing` drives the analyst — this event hook on
// `project/db.article_takes.insert` is what actually runs the explainer (`ctx.input` IS the row).
export default {
  type: 'event',
  on: { event: 'project/db.article_takes.insert' },
  // A take is a short, cached reframing of one already-synthesized article (no web I/O), so a
  // tight episode cap is plenty — it keeps a burst of TL;DR/ELI5/why-me requests cheap.
  budget: { maxEpisodes: 8 },
  handler: async ({
    input,
    delegate,
  }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // Skip a row that has already been filled (has a body) or isn't `pending` (idempotence /
    // loop guard — the explainer's own update back to this same row is a `write`, not an
    // `insert`, so it does not re-trigger this). The explainer also self-queries the oldest
    // pending take; the structured `input` is now delivered to it.
    if (input && (input.body || input.status !== 'pending')) return;
    await delegate('editorial/explainer', 'explain', { input: { takeId: input?.id } });
  },
};

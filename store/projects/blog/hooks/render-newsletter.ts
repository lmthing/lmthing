// hooks/render-newsletter.ts — turn a freshly-completed digest into a send-ready edition.
// Fires when a digest row is inserted (`project/db.digests.insert`; `ctx.input` IS the written
// row). Skips digests that are still `building` (the curator seeds a `building` row first, then
// flips it to `ready` — we render on the `ready` state via the follow-up update path) and any
// digest that already has a newsletter (idempotence).
export default {
  type: 'event',
  on: { event: 'project/db.digests.insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({
    input,
    db,
    delegate,
  }: {
    input: any;
    db: { query: (t: string, o?: any) => Promise<any[]> };
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    if (input && input.status === 'building') return; // a freshly-seeded building row isn't renderable yet
    if (input) {
      const existing = await db.query('newsletters', { where: { digestId: input.id } });
      if (existing.length > 0) return; // idempotence — already rendered
    }
    await delegate('editorial/digest-writer', 'render', { input: { digestId: input?.id } });
  },
};

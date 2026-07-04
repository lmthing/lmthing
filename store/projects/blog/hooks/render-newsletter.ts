// hooks/render-newsletter.ts — turn a freshly-completed digest into a send-ready edition.
// Fires when a digest row is inserted. Skips digests that are still `building` (the curator
// seeds a `building` row first, then flips it to `ready` — we render on the `ready` state via
// the follow-up update path) and any digest that already has a newsletter (idempotence).
export default {
  type: 'database',
  on: { table: 'digests', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({
    row,
    db,
    delegate,
  }: {
    row: any;
    db: { query: (t: string, o?: any) => Promise<any[]> };
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    // `row` is absent on a manual/boot/cron run of this hook — the digest-writer self-queries
    // the newest `ready` digest lacking a newsletter, so just delegate in that case.
    if (row && row.status === 'building') return; // a freshly-seeded building row isn't renderable yet
    if (row) {
      const existing = await db.query('newsletters', { where: { digestId: row.id } });
      if (existing.length > 0) return; // idempotence — already rendered
    }
    await delegate('editorial/digest-writer', 'render', { input: { digestId: row?.id } });
  },
};

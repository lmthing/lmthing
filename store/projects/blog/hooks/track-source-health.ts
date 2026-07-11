// hooks/track-source-health.ts — deterministic (no model call) rolling fetch-reliability update.
// Fires whenever a new `raw_items` row lands (`project/db.raw_items.insert`; `ctx.input` IS the
// written row); keeps one `source_health` row per source up to date with fetch/item/error counts
// and a rolling success rate. Pure-db handler — no delegate/agent — so it never fires another
// agent episode and cannot loop.
export default {
  type: 'event',
  on: { event: 'project/db.raw_items.insert' },
  budget: { maxEpisodes: 20 },
  handler: async ({
    input,
    db,
  }: {
    input: any;
    db: {
      query: (t: string, o?: any) => Promise<any[]>;
      insert: (t: string, v: any) => Promise<any>;
      update: (t: string, o: any) => Promise<number>;
    };
  }) => {
    // Nothing to attribute without a source — bail.
    if (!input || !input.sourceId) return;

    const health = await db.query('source_health');
    const existing = health.find((h: any) => h.sourceId === input.sourceId);

    if (existing) {
      const fetchCount = (existing.fetchCount ?? 0) + 1;
      const errorCount = existing.errorCount ?? 0;
      const successRate = fetchCount > 0 ? Math.min(1, Math.max(0, (fetchCount - errorCount) / fetchCount)) : 1;
      await db.update('source_health', {
        where: { id: existing.id },
        set: {
          itemCount: (existing.itemCount ?? 0) + 1,
          fetchCount,
          lastStatus: 'ok',
          successRate,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await db.insert('source_health', {
        sourceId: input.sourceId,
        itemCount: 1,
        fetchCount: 1,
        errorCount: 0,
        lastStatus: 'ok',
        successRate: 1,
      });
    }
  },
};

// hooks/track-source-health.ts — deterministic (no model call) rolling fetch-reliability update.
// Fires whenever a new `raw_items` row lands; keeps one `source_health` row per source up to date
// with fetch/item/error counts and a rolling success rate. Pure-db handler — no delegate/agent —
// so it never fires another agent episode and cannot loop.
export default {
  type: 'database',
  on: { table: 'raw_items', event: 'insert' },
  budget: { maxEpisodes: 20 },
  handler: async ({
    row,
    db,
  }: {
    row: any;
    db: {
      query: (t: string, o?: any) => Promise<any[]>;
      insert: (t: string, v: any) => Promise<any>;
      update: (t: string, o: any) => Promise<number>;
    };
  }) => {
    // `row` is absent on a manual/boot/cron run of this hook — nothing to attribute, so bail.
    if (!row || !row.sourceId) return;

    const health = await db.query('source_health');
    const existing = health.find((h: any) => h.sourceId === row.sourceId);

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
        sourceId: row.sourceId,
        itemCount: 1,
        fetchCount: 1,
        errorCount: 0,
        lastStatus: 'ok',
        successRate: 1,
      });
    }
  },
};

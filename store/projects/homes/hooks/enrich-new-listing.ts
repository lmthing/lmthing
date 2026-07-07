export default {
  type: 'database',
  on: { table: 'listings', event: 'insert' },
  budget: { maxEpisodes: 12, maxWallClockMs: 900000 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — a listing only ever gets ONE analysis pass. If it's already been
    // through the pipeline (a listing_analyses row exists), a re-fired insert event
    // (e.g. a merge that re-touches the row) is a no-op here.
    const existing = await db.query('listing_analyses', { where: { listingId: row.id } });
    if (Array.isArray(existing) && existing.length) return;

    // The whole intake→scout enrichment pipeline lives in THIS ONE HOOK, run as four
    // sequential delegate calls, rather than each stage re-triggering the next via its
    // own insert hook. This is a deliberate depth-cap: every one of these delegates
    // writes to OTHER tables (listing_analyses, location_guesses, listings.score, …),
    // never back to `listings` in a way that would re-fire THIS hook's `insert` trigger
    // (updates aren't `insert`, and none of these steps inserts a new `listings` row) —
    // so there is no risk of the chain cascading back onto itself. Keeping the whole
    // pipeline in one hook also means the budget/wall-clock caps above bound the
    // entire enrichment of one listing, not just its first stage.
    await delegate('intake/surveyor', 'normalize', { input: { listingId: row.id } });
    await delegate('scout/analyst', 'analyze', { input: { listingId: row.id } });
    await delegate('scout/locator', 'locate', { input: { listingId: row.id } });
    await delegate('scout/ranker', 'rank', { input: { listingId: row.id } });
  },
};

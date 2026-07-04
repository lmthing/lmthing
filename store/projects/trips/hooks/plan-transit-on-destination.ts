export default {
  type: 'database',
  on: { table: 'destinations', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — skip if a transit leg already arrives at this destination.
    const legs = await db.query('transit_legs', { where: { toDestinationId: row.id } });
    if (Array.isArray(legs) && legs.length) return;
    // Plan the ordered legs for the whole trip (the navigator skips pairs it has already covered).
    // Runs alongside research-new-destination; the navigator writes only transit_legs, so its
    // writes never re-fire the destinations hooks (self-write exclusion + distinct table).
    await delegate('logistics/navigator', 'plan-transit', { input: { tripId: row.tripId } });
  },
};

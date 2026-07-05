export default {
  type: 'database',
  on: { table: 'travelers', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — skip if the host has already written a party preferences note for this trip.
    const notes = await db.query('knowledge_notes', { where: { tripId: row.tripId } });
    if (Array.isArray(notes) && notes.some((n: any) => n.topic === 'Party preferences & constraints')) return;
    await delegate('companions/host', 'reconcile', { input: { tripId: row.tripId } });
  },
};

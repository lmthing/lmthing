export default {
  type: 'event',
  on: { event: 'project/db.travelers.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — skip if the host has already written a party preferences note for this trip.
    const notes = await db.query('knowledge_notes', { where: { tripId: input.tripId } });
    if (Array.isArray(notes) && notes.some((n: any) => n.topic === 'Party preferences & constraints')) return;
    await delegate('companions/host', 'reconcile', { input: { tripId: input.tripId } });
  },
};

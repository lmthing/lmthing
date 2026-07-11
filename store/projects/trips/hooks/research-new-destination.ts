export default {
  type: 'event',
  on: { event: 'project/db.destinations.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    const existing = await db.query('research', { where: { destinationId: input.id } });
    if (Array.isArray(existing) && existing.length) return; // idempotence
    await delegate('concierge/researcher', 'dive', { input: { destinationId: input.id } });
  },
};

export default {
  type: 'database',
  on: { table: 'destinations', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    const existing = await db.query('research', { where: { destinationId: row.id } });
    if (Array.isArray(existing) && existing.length) return; // idempotence
    await delegate('concierge/researcher', 'dive', { input: { destinationId: row.id } });
  },
};

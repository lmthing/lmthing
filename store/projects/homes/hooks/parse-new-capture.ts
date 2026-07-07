export default {
  type: 'database',
  on: { table: 'raw_captures', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Only pending captures need parsing — a re-fired insert event (or a capture the
    // clipper already claimed) is a no-op here.
    if (row.status !== 'pending') return;
    await delegate('intake/clipper', 'parse', { input: { captureId: row.id } });
  },
};

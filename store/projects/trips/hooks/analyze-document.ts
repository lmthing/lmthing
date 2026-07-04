export default {
  type: 'database',
  on: { table: 'documents', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, db, delegate }: { row: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — only analyze a freshly-uploaded, unprocessed document.
    if (row.status && row.status !== 'pending') return;
    const existing = await db.query('document_extractions', { where: { documentId: row.id } });
    if (Array.isArray(existing) && existing.length) return;
    await delegate('records/analyst', 'analyze', { input: { documentId: row.id } });
  },
};

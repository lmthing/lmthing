export default {
  type: 'event',
  on: { event: 'project/db.documents.insert' },
  // Extraction runs classify → extract → research-followup through the model; give it enough
  // room to reach the terminal `analyzed`/`error` status even on a busy pod (a too-small
  // episode budget can leave a document stuck 'analyzing' — a perpetual spinner in the UI).
  budget: { maxEpisodes: 24, maxWallClockMs: 600000 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — only analyze a freshly-uploaded, unprocessed document.
    if (input.status && input.status !== 'pending') return;
    const existing = await db.query('document_extractions', { where: { documentId: input.id } });
    if (Array.isArray(existing) && existing.length) return;
    await delegate('records/analyst', 'analyze', { input: { documentId: input.id } });
  },
};

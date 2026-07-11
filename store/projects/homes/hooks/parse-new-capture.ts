export default {
  type: 'event',
  on: { event: 'project/db.raw_captures.insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<{ ok: boolean; result?: unknown; error?: string; sessionId?: string }> }) => {
    // Only pending captures need parsing — a re-fired insert event (or a capture the
    // clipper already claimed) is a no-op here.
    if (input.status !== 'pending') return;
    await delegate('intake/clipper', 'parse', { input: { captureId: input.id } });
  },
};

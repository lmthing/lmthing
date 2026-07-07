export default {
  type: 'database',
  on: { table: 'quicklog_drafts', event: 'insert' },
  // Declarative "reconcile now" signal — no id is threaded. The logger self-queries
  // every `pending` quicklog_drafts row, parses the free-text into a structured,
  // reviewable `proposedActions` list, and marks the draft `ready`. It writes ONLY the
  // draft row (never the real metrics/symptoms/medications tables) — those are applied
  // by commitQuickLog after the user confirms (confirm-before-write). The draft UPDATE
  // is self-write-excluded from this insert-only hook, so the loop is bounded.
  trigger: 'clinic/logger#draft',
  budget: { maxEpisodes: 6, maxWallClockMs: 180000 },
};

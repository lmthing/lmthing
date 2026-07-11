export default {
  type: 'event',
  on: { event: 'project/db.triage_assessments.insert' },
  // Declarative "reconcile now" signal — no id is threaded. The triage-nurse self-queries every
  // `pending` triage_assessments row and writes a conservative, knowledge-grounded urgency
  // observation (never a diagnosis). That UPDATE is self-write-excluded from this insert-only hook,
  // so the loop is bounded. Triage is intentionally free (safety should not be paywalled).
  trigger: 'care/triage-nurse#assess',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

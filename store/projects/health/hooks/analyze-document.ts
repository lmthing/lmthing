export default {
  type: 'event',
  on: { event: 'project/db.documents.insert' },
  // Declarative trigger: a hook delegate does not thread structured input to the agent, so this is a
  // plain "reconcile now" signal. The records/analyst finds its own work — it processes every document
  // still `status:'pending'`, extracts its data by kind, writes provenance rows, and sets the document
  // to 'analyzed'/'error'. Its own `documents.status` UPDATE is a self-write (excluded from re-firing
  // this insert-only hook), so a burst of uploads coalesces into one pass and the loop is bounded.
  trigger: 'records/analyst#analyze',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

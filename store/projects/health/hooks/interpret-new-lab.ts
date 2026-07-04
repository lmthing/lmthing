export default {
  type: 'database',
  on: { table: 'lab_results', event: 'insert' },
  // Declarative trigger: a hook delegate does not thread structured input to the agent, so this
  // is a plain "reconcile now" signal. The interpreter finds its own work — it re-flags every lab
  // result against its reference range (idempotent: it only writes a row whose flag is wrong), so a
  // burst of inserts coalesces into one reconcile. The interpreter's `flag` UPDATE is a self-write
  // (excluded from re-firing this insert-only hook), so the loop is bounded.
  trigger: 'clinic/interpreter#interpret',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

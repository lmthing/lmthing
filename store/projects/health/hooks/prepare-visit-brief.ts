export default {
  type: 'event',
  on: { event: 'project/db.visit_briefs.insert' },
  // Declarative trigger: a hook delegate carries no id, so this is a "reconcile now" signal. The
  // clinic/interpreter finds its own work — it compiles every visit brief still `status:'pending'`
  // from recent flagged labs, active symptoms, metric trends, and ready research, then marks it
  // 'ready'. Its `visit_briefs` UPDATE is self-write-excluded from this insert-only hook (bounded).
  trigger: 'clinic/interpreter#prep',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};

export default {
  type: 'cron',
  // A 7-day cadence — the interpreter writes one narrative "Your week in health" insights
  // row per run (it self-guards against writing twice in the same week). Declarative
  // "reconcile now" signal; the interpreter finds its own work. It writes only `insights`
  // (nothing watches that for its own re-trigger), so the pass is bounded.
  every: '7d',
  trigger: 'clinic/interpreter#weekly',
  budget: { maxEpisodes: 4, maxWallClockMs: 300000 },
};

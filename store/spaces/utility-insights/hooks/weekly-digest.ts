// Weekly data digest. The cron primitive is DAILY, so this fires every morning at 08:00 and the
// digest tasklist's first step (`01-gate`) decides whether today is the day: `shouldRun` is true
// only on Mondays (UTC), and every downstream step is conditioned on it — so six mornings out of
// seven the run stops at the gate and costs one cheap episode. Declarative trigger form: a cron
// delegate carries no structured input, so the digest self-queries its work and is idempotent (the
// report row dedupes on `week:<isoWeek>`). The chain is terminal: the digest writes only
// `insight_reports`, and this space ships no hook on that table — consumers (a project hook,
// utility-dispatcher) subscribe to the synthetic `project/db.insight_reports.insert` themselves.
export default {
  type: 'cron',
  daily: '08:00',
  trigger: 'utility-insights/analyst#digest',
  budget: { maxEpisodes: 14, maxWallClockMs: 600000 },
};

// Daily deadline sweep: every morning the keeper re-scans all active watchers and records any
// newly approaching deadlines. Declarative trigger form — a cron delegate carries no structured
// input, so the sweep tasklist self-queries its work (active watchers) and is idempotent (alerts
// dedupe on `dedupeKey`). The chain is terminal: the sweep writes only `deadline_alerts`, and this
// space ships no hook on that table — consumers (a project hook, utility-dispatcher) subscribe to
// the synthetic `project/db.deadline_alerts.insert` themselves.
export default {
  type: 'cron',
  daily: '07:00',
  trigger: 'utility-deadlines/keeper#sweep',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
};

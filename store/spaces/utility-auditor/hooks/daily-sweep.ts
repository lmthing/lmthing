// Daily change sweep: every morning the auditor diffs each active binding's rows against the last
// snapshot and appends what changed to `audit_log`. Declarative trigger form — a cron delegate
// carries no structured input, so the sweep tasklist self-queries its work (active bindings) and
// is idempotent (entries dedupe on `changeKey`, which is truncated to the sweep DAY, so a retry
// re-records nothing). It runs early, before the day's edits, so a sweep sees a settled table.
// The chain is terminal: the sweep writes only `audit_snapshots`/`audit_log`, and this space ships
// no hook on either — consumers (a project hook, utility-dispatcher) subscribe to the synthetic
// `project/db.audit_log.insert` themselves.
export default {
  type: 'cron',
  daily: '05:45',
  trigger: 'utility-auditor/auditor#sweep',
  budget: { maxEpisodes: 16, maxWallClockMs: 900000 },
};

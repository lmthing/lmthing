// Daily contract check: every morning the inspector re-evaluates every active rule against the
// host app's rows. Declarative trigger form — a cron delegate carries no structured input, so the
// check tasklist self-queries its work (active rules) and is idempotent (violations dedupe on
// `violationKey`; a violation whose key stops being produced by a scanned table auto-resolves).
// The chain is terminal: the check writes only `validation_violations`, and this space ships no
// hook on that table — consumers subscribe to `project/db.validation_violations.insert` themselves.
export default {
  type: 'cron',
  daily: '06:30',
  trigger: 'utility-validator/inspector#check',
  budget: { maxEpisodes: 14, maxWallClockMs: 600000 },
};

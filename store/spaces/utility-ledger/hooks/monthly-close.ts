// Monthly close, driven by a DAILY cron: the schedule fires every morning, and the `close`
// tasklist's first step (`01-gate.md`) decides whether today is actually the 1st of the month —
// `new Date().getUTCDate() === 1`. The gate lives in the tasklist, not here, because cron hooks
// have no day-of-month field and a delegate carries no structured input: the action must
// self-query its work and be idempotent. On the other 30 days the gate resolves
// `shouldRun: false`, every downstream step's condition is false, and the run costs one cheap
// step. The chain is terminal: close writes only `ledger_reports`, and this space ships no hook on
// that table — consumers (a project hook, utility-dispatcher) subscribe to the synthetic
// `project/db.ledger_reports.insert` themselves.
export default {
  type: 'cron',
  daily: '07:30',
  trigger: 'utility-ledger/bookkeeper#close',
  budget: { maxEpisodes: 14, maxWallClockMs: 600000 },
};

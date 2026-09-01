// Route on arrival: whenever anything lands in this space's own `intake_items` table, run the
// triage pass. Declarative trigger form — a hook delegate carries no structured input, so this is
// a plain "reconcile now" signal and the triage tasklist self-queries EVERY pending item, which
// also coalesces a burst of deliveries into one pass.
//
// The loop is bounded: triage's own writes to `intake_items` are UPDATES (status/routedTable),
// and this hook fires on insert only, so it never re-triggers itself. Rows the triage inserts into
// TARGET tables may legitimately fire the host app's own hooks — that is the point of routing.
export default {
  type: 'event',
  on: { event: 'project/db.intake_items.insert' },
  trigger: 'utility-intake/triager#triage',
  budget: { maxEpisodes: 10, maxWallClockMs: 300000 },
};

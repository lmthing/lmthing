export default {
  type: 'event',
  on: { event: 'project/db.care_shares.insert' },
  // Declarative "reconcile now" signal — no id is threaded. The coordinator self-queries every
  // `pending` care_shares row and compiles the printable summary from the record (labs, meds,
  // insights, upcoming appointments), then marks it `ready`. That UPDATE is self-write-excluded from
  // this insert-only hook, so the loop is bounded.
  trigger: 'care/coordinator#compile',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};

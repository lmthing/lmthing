export default {
  type: 'event',
  on: { event: 'project/db.interactions.insert' },
  // Declarative trigger: a hook delegate does not thread structured input, so this is a plain
  // "reconcile now" signal. The pharmacist finds its own work — it fills every interaction row still
  // `pending` by researching the pairing in the literature (universal webSearch/webFetch) and writing
  // a cited finding. That is an UPDATE (status→'ready'), self-write-excluded from this insert-only
  // hook, so the loop is bounded.
  trigger: 'pharmacy/pharmacist#review',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

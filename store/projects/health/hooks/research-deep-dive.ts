export default {
  type: 'event',
  on: { event: 'project/db.research.insert' },
  // Declarative trigger: a hook delegate does not thread structured input to the agent, so this is
  // a plain "reconcile now" signal. research rows are inserted by the interpreter (abnormal lab +
  // subscription) or the user's requestResearch call; the researcher finds its own work — it fills
  // every row still `pending` and only UPDATEs it (body + status), so it never re-fires this
  // insert-only hook. Bounded to one reconcile per burst of pending research.
  trigger: 'clinic/researcher#deep-dive',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

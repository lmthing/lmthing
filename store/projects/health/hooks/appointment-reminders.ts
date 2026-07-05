export default {
  type: 'cron',
  daily: '07:00',
  // Each morning the care/coordinator surfaces upcoming appointments. For an appointment within 48h
  // that has no prep brief yet, it inserts a pending `visit_briefs` row — which fires the existing
  // `prepare-visit-brief` hook so the interpreter compiles the brief — and links it back to the
  // appointment via `prepBriefId` (a clean cross-space chain over the shared db). Inserting one
  // visit_briefs row per un-prepped imminent appointment is naturally bounded; the interpreter's
  // brief write is an UPDATE, self-write-excluded from its own insert hook.
  trigger: 'care/coordinator#reminders',
  budget: { maxEpisodes: 4, maxWallClockMs: 300000 },
};

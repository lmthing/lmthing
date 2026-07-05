// Daily: the planner self-queries pantry ingredients with a near expiresAt, finds
// recipes that use them, and writes suggestions (type 'use-it-up'). Declarative trigger
// form is used since delegate/trigger drops structured input anyway — the planner has
// no row to react to here (this is a cron run) and must self-query. suggestions has no
// hook watching it, so this chain is terminal (bounded).
export default {
  type: 'cron',
  daily: '08:00',
  trigger: 'chef/planner#suggest-uses',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};

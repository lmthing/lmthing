// Daily: the optimizer self-queries out-of-stock / expiring / expensive ingredients and
// writes substitutions plus a suggestions row (type 'substitution'). Declarative trigger
// form is used since delegate/trigger drops structured input anyway — the optimizer has
// no row to react to here (this is a cron run) and must self-query. Neither
// substitutions nor suggestions has a hook watching it, so this chain is terminal
// (bounded).
export default {
  type: 'cron',
  daily: '07:00',
  trigger: 'sourcing/optimizer#substitutions',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};

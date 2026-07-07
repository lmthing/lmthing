export default {
  type: 'cron',
  every: '6h',
  // Declarative: the clipper's `refresh` action self-scans each active search's tracked
  // listings (status not dismissed/gone), re-fetches, and marks gone/price-changed/back-
  // online. (Cron hooks support `trigger` only — imperative handlers are for `database`
  // hooks.)
  trigger: 'intake/clipper#refresh',
  budget: { maxEpisodes: 10, maxWallClockMs: 600000 },
};

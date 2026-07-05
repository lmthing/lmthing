export default {
  type: 'cron',
  every: '24h',
  // Declarative: the deal-hunter's `hunt` action self-scans active trips for money-saving
  // deals. (Cron hooks support `trigger` only — imperative handlers are for `database` hooks.)
  trigger: 'finance/deal-hunter#hunt',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

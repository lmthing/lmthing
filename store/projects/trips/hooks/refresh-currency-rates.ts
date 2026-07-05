export default {
  type: 'cron',
  every: '24h',
  // Declarative: the treasurer's `refresh-rates` action self-scans trips with mixed-currency
  // expenses and refreshes cached currency_rates. (Cron hooks support `trigger` only —
  // imperative handlers are for `database` hooks.)
  trigger: 'finance/treasurer#refresh-rates',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};

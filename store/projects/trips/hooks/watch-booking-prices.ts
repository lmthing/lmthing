export default {
  type: 'cron',
  every: '12h',
  trigger: 'concierge/researcher#price-check',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};

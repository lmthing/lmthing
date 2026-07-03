export default {
  type: 'cron',
  every: '30m',
  trigger: 'newsroom/fetcher#refresh',
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 },
};

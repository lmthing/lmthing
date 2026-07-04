export default {
  type: 'cron',
  daily: '08:00',
  trigger: 'clinic/interpreter#digest',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};

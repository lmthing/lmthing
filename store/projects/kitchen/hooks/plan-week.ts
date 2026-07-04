export default {
  type: 'cron',
  daily: '18:00',
  trigger: 'chef/planner#plan',
  budget: { maxEpisodes: 15, maxWallClockMs: 600000 },
};

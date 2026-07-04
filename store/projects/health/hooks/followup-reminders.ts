export default {
  type: 'cron',
  daily: '07:30',
  // Each morning the coaching/coach surfaces follow-ups whose `dueAt` has passed and that are not
  // `done`, as a plain-language reminder — turning a one-time flag into managed care over time.
  trigger: 'coaching/coach#reminders',
  budget: { maxEpisodes: 4, maxWallClockMs: 300000 },
};

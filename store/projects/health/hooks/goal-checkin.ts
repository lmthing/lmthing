export default {
  type: 'cron',
  daily: '20:00',
  // Each evening the coaching/coach checks each active goal against the user's own metrics, fills in
  // `current` progress, marks a met goal, and — when a goal is slipping — proposes a follow-up. Its
  // writes are UPDATEs/inserts on goals/followups, not watched by any insert hook here (bounded).
  trigger: 'coaching/coach#checkin',
  budget: { maxEpisodes: 4, maxWallClockMs: 300000 },
};

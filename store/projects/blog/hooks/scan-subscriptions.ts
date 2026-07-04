// hooks/scan-subscriptions.ts — periodically evaluate every active subscription against recent
// articles and raise deduped alerts for new matches. Cron-triggered (no structured input crosses
// the trigger boundary), so the librarian self-queries its own active subscriptions and the
// recent article window rather than being handed anything here.
export default {
  type: 'cron',
  every: '30m',
  trigger: 'research/librarian#scan',
  budget: { maxEpisodes: 15, maxWallClockMs: 600000 },
};

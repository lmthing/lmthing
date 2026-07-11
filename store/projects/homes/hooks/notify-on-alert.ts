export default {
  type: 'event',
  on: { event: 'project/db.alerts.insert' },
  // Deliver alerts OUTSIDE the app — the whole value is speed. This hook is
  // imperative + fully graceful: with no channel configured it is a clean no-op,
  // so the app builds and runs anywhere. A pod operator opts in by setting
  // HOMES_NOTIFY_WEBHOOK (any HTTPS endpoint — Slack/Discord/Telegram-bridge/
  // custom relay); richer channels (Web Push VAPID, email) route through the
  // gateway per the repo's backend rule and are a Next item.
  budget: { maxEpisodes: 2 },
  handler: async ({ input }: { input: any }) => {
    const webhook = process.env.HOMES_NOTIFY_WEBHOOK;
    if (!webhook) return; // feature-flag off — no channel wired, nothing to do.

    // Only notify on the kinds worth interrupting someone for.
    const NOTIFY_KINDS = ['new_match', 'price_drop', 'gone', 'back_online', 'digest'];
    if (!NOTIFY_KINDS.includes(input?.kind)) return;

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'lmthing.homes',
          kind: input.kind,
          title: input.title,
          body: input.body ?? '',
          searchId: input.searchId,
          listingId: input.listingId ?? null,
          createdAt: input.createdAt ?? new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort — a failed notification must never fail the alert insert.
    }
  },
};

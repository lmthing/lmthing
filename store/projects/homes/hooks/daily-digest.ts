export default {
  type: 'cron',
  // Once a day — a briefing you receive, not a feed you scan. Latency is
  // irrelevant on a cron, so the ranker can take its time summarizing.
  daily: '07:00',
  // Declarative: the ranker's `digest` action self-scans every ACTIVE search,
  // reads its listings/alerts/taste_notes, and writes one `alerts` row
  // (kind: 'digest') per search — "state of the hunt" surfaced at the top of the
  // feed and, via the alerts insert, delivered by notify-on-alert.
  trigger: 'scout/ranker#digest',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
};

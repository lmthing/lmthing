// Daily hygiene scan: every morning the janitor re-inspects the host app's tables and queues what
// it finds. Declarative trigger form — a cron delegate carries no structured input, so the scan
// tasklist self-queries its work. The scan is idempotent via `findingKey` (check-before-insert), so
// a daily run is free: unchanged data produces zero new rows. Findings only ever land as
// `proposed` — nothing in this chain modifies a host-app row, so the chain is terminal.
export default {
  type: 'cron',
  daily: '06:00',
  trigger: 'utility-janitor/janitor#scan',
  budget: { maxEpisodes: 14, maxWallClockMs: 600000 },
};

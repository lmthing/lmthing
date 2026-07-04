export default {
  type: 'cron',
  every: '24h',
  // Declarative: cron hooks run an agent#action with no per-run input, so the packer's
  // `pack-due` action self-scans for trips departing soon and (re)builds their packing lists
  // against the latest forecast. (Cron hooks support `trigger` only — imperative handlers are
  // for `database` hooks.)
  trigger: 'logistics/packer#pack-due',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};

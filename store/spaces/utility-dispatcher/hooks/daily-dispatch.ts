// Daily dispatch: every morning the dispatcher checks each active rule for queue rows created
// since its watermark and delivers a digest to the rule's configured channel. Declarative trigger
// form — a cron delegate carries no structured input, so the tasklist self-queries its work.
// Re-runs are free: the watermark advances only when a delivery is logged 'sent', and `batchKey`
// blocks a duplicate. Rules with nothing new send nothing at all. The chain is terminal: the run
// writes only `dispatch_log`, and no hook in this space listens to that table.
export default {
  type: 'cron',
  daily: '08:30',
  trigger: 'utility-dispatcher/dispatcher#dispatch',
  budget: { maxEpisodes: 16, maxWallClockMs: 900000 },
};

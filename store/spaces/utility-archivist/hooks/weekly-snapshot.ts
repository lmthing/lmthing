// Weekly table snapshot. The cron fires DAILY at 05:30 and the snapshot tasklist's first step is a
// gate that resolves `shouldRun: false` on any day except Sunday (UTC) — the gate lives inside the
// tasklist rather than in the schedule so the same action can be run by hand on any day and still
// behave predictably, and so a missed Sunday is retried the next Sunday without a second hook.
//
// A cron delegate carries no structured input, so the action self-queries its work (active policies
// with snapshotEnabled) and is idempotent: snapshots dedupe on `snapshotKey` (one per table per
// day), so a re-fire writes nothing. The chain is terminal — this space writes only its own
// `archive_*` tables and ships no hook on them.
export default {
  type: 'cron',
  daily: '05:30',
  trigger: 'utility-archivist/archivist#snapshot',
  budget: { maxEpisodes: 14, maxWallClockMs: 900000 },
};

export default {
  // A user hitting "Check now" (the pollSource endpoint) stamps `sources.pollRequestedAt`,
  // which is a `sources` UPDATE — this hook fires the clipper's poll action in response.
  //
  // Why a declarative `trigger` and not an imperative `handler`: the hook runner delegates a
  // handler with a terse prose message ("Hook … delegate — 'poll'.") AND drops the handler's
  // `opts`, and in practice the clipper mis-routes that to its default `parse` action. The
  // declarative trigger reuses the exact reliable path the poll cron uses ("perform the
  // 'poll' action"), which routes correctly.
  //
  // Firing policy makes this safe despite being an unconditional table-level trigger:
  //   • the eligibility gate is `politeFetchPlan` — a poll only fetches sources that are due
  //     OR carry a pending `pollRequestedAt` (after their last poll), so an unrelated sources
  //     edit fires a clipper run that simply finds nothing to fetch;
  //   • the dispatcher's self-write exclusion means the clipper's own `lastPolledAt` /
  //     `blockedReason` writes (made inside this hook's triggered session) never re-fire it;
  //   • the per-hook cooldown coalesces a burst of edits into one run.
  type: 'event',
  on: { event: 'project/db.sources.update' },
  trigger: 'intake/clipper#poll',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};

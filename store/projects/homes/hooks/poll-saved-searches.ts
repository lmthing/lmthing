export default {
  type: 'cron',
  every: '6h',
  // Declarative: the clipper's `poll` action self-scans pollEnabled sources due per
  // their interval (politeFetchPlan), robots-checks each host, and inserts fresh
  // raw_captures — which re-enter the parse pipeline via parse-new-capture.
  trigger: 'intake/clipper#poll',
  budget: { maxEpisodes: 10, maxWallClockMs: 600000 },
};

/**
 * One dated metric reading, as stored in the `metrics` table.
 */
export interface MetricPoint {
  kind: string;
  value: number;
  recordedAt: string;
}

/**
 * Compute a goal's current progress against `metricKind` as the mean of the most recent
 * (up to) 7 readings of that kind — a small rolling window that reflects "where the user is
 * right now" without being thrown off by a single outlier reading. Returns 0 when there are no
 * matching readings at all.
 */
export function goalProgress(metrics: MetricPoint[], metricKind: string): number {
  const recent = metrics
    .filter((m) => m.kind === metricKind)
    .slice()
    .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''))
    .slice(0, 7);
  if (recent.length === 0) return 0;
  const sum = recent.reduce((total, m) => total + m.value, 0);
  return sum / recent.length;
}

/**
 * Detect a rolling trend across a short series of values (e.g. a metric's last few readings) as
 * the percent change from the first value to the last — a quick, cheap signal for "is this
 * moving up, down, or flat lately" without a full regression. Positive means rising, negative
 * means falling, and values near zero mean roughly flat. Returns 0 when there are fewer than two
 * values (nothing to compare) or when the first value is 0 (a percent change would be undefined).
 */
export function computeTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return 0;
  return Math.round(((last - first) / Math.abs(first)) * 100);
}

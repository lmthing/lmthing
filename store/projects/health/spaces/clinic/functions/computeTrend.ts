/**
 * Percent change from the first value in the series to the last — the simplest honest measure of
 * "which way has this been moving," used for the daily digest's rolling trends and the appointment
 * prep brief's trend summaries. Fewer than 2 values means there's nothing to compare, so it
 * returns `0` rather than a misleading spike. Rounded to the nearest whole percent.
 */
export function computeTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return 0;
  return Math.round(((last - first) / Math.abs(first)) * 100);
}

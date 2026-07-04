/**
 * The user's OWN historical baseline for an analyte or metric — distinct from the population
 * reference range printed on a lab report. Computed as mean ± 2 standard deviations over the
 * user's own past values, so a later reading can be checked against "is this a sharp move from
 * what's normal for ME" even when it's still inside the population range.
 *
 * Returns `null` when there are fewer than 3 values — too few points to trust a spread estimate,
 * so the caller should leave any cached personalLow/personalHigh alone rather than write a
 * baseline computed from noise.
 */
export interface Baseline {
  low: number;
  high: number;
}

export function personalBaseline(values: number[]): Baseline | null {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (clean.length < 3) return null;

  const mean = clean.reduce((sum, v) => sum + v, 0) / clean.length;
  const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clean.length;
  const sd = Math.sqrt(variance);

  return { low: mean - 2 * sd, high: mean + 2 * sd };
}

/**
 * Flag a lab value against its printed reference range — `'high'` if a `refHigh` is set and the
 * value exceeds it, `'low'` if a `refLow` is set and the value falls under it, otherwise
 * `'normal'`. Either bound may be absent (an open-ended range, e.g. no lower bound on a marker
 * that's only ever a concern when elevated) — an absent bound never triggers a flag on its side.
 */
export function flagFromRange(value: number, refLow?: number, refHigh?: number): 'low' | 'normal' | 'high' {
  if (refHigh != null && value > refHigh) return 'high';
  if (refLow != null && value < refLow) return 'low';
  return 'normal';
}

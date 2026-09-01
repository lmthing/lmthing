/**
 * The previous UTC calendar month as a half-open range — pure, deterministic, never throws.
 *
 * `periodStart` is the first day of the previous month (inclusive), `periodEnd` is the first day
 * of `nowIso`'s own month (EXCLUSIVE) — the same `[start, end)` convention `summarizePeriod`
 * consumes, so no off-by-one day arithmetic is ever needed at the call site. January rolls back to
 * the previous December correctly.
 *
 * Everything is UTC: a monthly close must not shift because the pod is in a different timezone
 * than the user was when the row was written.
 *
 * @param nowIso  The reference instant as an ISO string — inject it; never read the clock here.
 * @returns `{ periodStart: 'YYYY-MM-01', periodEnd: 'YYYY-MM-01', label: 'YYYY-MM' }`, or `null`
 *          when `nowIso` is not a parseable instant.
 */
export function previousMonthRange(
  nowIso: unknown,
): { periodStart: string; periodEnd: string; label: string } | null {
  if (typeof nowIso !== 'string' || nowIso.trim() === '') return null;
  const t = Date.parse(nowIso.trim().length === 10 ? `${nowIso.trim()}T00:00:00Z` : nowIso.trim());
  if (Number.isNaN(t)) return null;

  const now = new Date(t);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  const pad = (n: number): string => String(n).padStart(2, '0');
  const label = `${prevYear}-${pad(prevMonth + 1)}`;
  return {
    periodStart: `${label}-01`,
    periodEnd: `${year}-${pad(month + 1)}-01`,
    label,
  };
}

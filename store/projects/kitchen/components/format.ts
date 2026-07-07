/** Shared formatting helpers for kitchen pages/components. */

/** "2026-07-06" → "Mon, Jul 6". Falls back to the raw string if unparseable. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '';
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "2026-07-06" → "Jul 6". */
export function formatShortDate(day: string | null | undefined): string {
  if (!day) return '';
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

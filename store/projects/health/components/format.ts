// Shared date/number formatting so timestamps read as friendly local dates
// (e.g. "May 8, 2026" · "May 8, 2026, 3:40 PM") instead of raw ISO strings.

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "May 8, 2026" — a calendar day, no time. */
export function fmtDate(iso?: string | null): string {
  const d = toDate(iso);
  if (!d) return iso ?? '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "May 8, 2026, 3:40 PM" — day plus time. */
export function fmtDateTime(iso?: string | null): string {
  const d = toDate(iso);
  if (!d) return iso ?? '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "3:40 PM" — time only. */
export function fmtTime(iso?: string | null): string {
  const d = toDate(iso);
  if (!d) return iso ?? '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Relative like "in 3 days", "2 days ago", "today". */
export function fmtRelative(iso?: string | null): string {
  const d = toDate(iso);
  if (!d) return iso ?? '';
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

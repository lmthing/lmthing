// Small display helpers shared across the trips app.
// Data stores raw ISO strings ('2026-10-12' or '2026-10-12T08:10:00Z'); these
// turn them into friendly, locale-aware labels without timezone drift.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Parts {
  y: number;
  m: number; // 1-12
  d: number;
  hh?: number;
  mm?: number;
}

function parse(iso?: string | null): Parts | null {
  if (!iso) return null;
  const match = String(iso).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/,
  );
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const parts: Parts = { y: Number(y), m: Number(m), d: Number(d) };
  if (hh !== undefined) {
    parts.hh = Number(hh);
    parts.mm = Number(mm);
  }
  return parts;
}

/** '2026-10-12' -> 'Oct 12, 2026'. Returns '' for empty/invalid. */
export function formatDate(iso?: string | null): string {
  const p = parse(iso);
  if (!p) return '';
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/** '2026-10-12T08:10:00Z' -> 'Oct 12, 08:10'. Falls back to date only. */
export function formatDateTime(iso?: string | null): string {
  const p = parse(iso);
  if (!p) return '';
  const date = `${MONTHS[p.m - 1]} ${p.d}`;
  if (p.hh === undefined) return `${date}, ${p.y}`;
  const hh = String(p.hh).padStart(2, '0');
  const mm = String(p.mm ?? 0).padStart(2, '0');
  return `${date}, ${hh}:${mm}`;
}

/** Two dates -> a compact range, collapsing shared month/year. */
export function formatDateRange(start?: string | null, end?: string | null): string {
  const a = parse(start);
  const b = parse(end);
  if (a && b) {
    if (a.y === b.y && a.m === b.m) {
      return `${MONTHS[a.m - 1]} ${a.d} – ${b.d}, ${a.y}`;
    }
    if (a.y === b.y) {
      return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`;
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (a) return formatDate(start);
  if (b) return formatDate(end);
  return '';
}

/** Money with the currency symbol when the runtime knows it, else a suffix. */
export function formatMoney(amount: number, currency?: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

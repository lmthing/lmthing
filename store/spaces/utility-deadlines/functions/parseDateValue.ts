/**
 * Lenient date parser — returns a canonical ISO-8601 string (UTC) or `null`, never throws.
 *
 * Accepts the shapes that actually show up in app tables: ISO date (`2026-07-26`) and datetime
 * (with or without timezone), `YYYY/MM/DD`, `YYYY-MM-DD HH:mm[:ss]`, epoch milliseconds and epoch
 * seconds (number or numeric string). Anything else — empty, null, prose, plain numbers that are
 * not plausible epochs — is `null`. Deterministic: no reference to the current clock.
 *
 * @param value  A raw cell value (string | number | anything).
 * @returns Canonical ISO string (`YYYY-MM-DDTHH:mm:ss.sssZ`) or `null`.
 */
export function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // Epoch heuristic: seconds land roughly in 1973..5138 as 1e8..1e11; ms as 1e11..1e14.
    if (value >= 1e11 && value < 1e14) return new Date(value).toISOString();
    if (value >= 1e8 && value < 1e11) return new Date(value * 1000).toISOString();
    return null; // small numbers (ids, counts, years alone) are not dates
  }

  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s === '') return null;

  // Numeric string → same epoch heuristic as numbers.
  if (/^\d+$/.test(s)) return parseDateValue(Number(s));

  // Date-shaped strings only — bare Date.parse is too eager ("Report 12" parses in some engines).
  const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!dateShape.test(s)) return null;

  const normalized = s.replace(/\//g, '-').replace(' ', 'T');
  const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

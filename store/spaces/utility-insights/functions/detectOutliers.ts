/**
 * Textbook Tukey fences over one numeric column — pure, deterministic, never throws.
 *
 * A value is an outlier when it falls strictly outside `[Q1 - 1.5·IQR, Q3 + 1.5·IQR]`; a value
 * sitting exactly ON a fence is NOT an outlier. Quartiles use linear interpolation between the two
 * nearest order statistics (the common "type 7" definition), so the result is stable and
 * reproducible for any input.
 *
 * Two deliberate refusals:
 *  - a row without an `id` is skipped — an outlier nobody can navigate back to is not actionable;
 *  - fewer than 4 usable numeric values ⇒ `[]` — quartiles over 3 points are noise, not signal.
 *
 * Self-contained by design: `toNumber` is duplicated locally because space functions are injected
 * standalone and cannot call each other.
 *
 * @param rows    The table's rows (as from `db.query(table)`).
 * @param column  The numeric column to inspect.
 * @returns `{ rowId, value }[]` sorted by value ascending, then rowId. Degrades to `[]`.
 */
export function detectOutliers(
  rows: Record<string, unknown>[] | null | undefined,
  column: string,
): { rowId: string; value: number }[] {
  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (s === '' || !/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  if (!Array.isArray(rows) || typeof column !== 'string' || column === '') return [];

  const points: { rowId: string; value: number }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const value = toNumber(row[column]);
    if (value === null) continue;
    const rawId = row['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
    if (rowId === '') continue; // a row we cannot re-identify cannot be reported
    points.push({ rowId, value });
  }
  if (points.length < 4) return [];

  const sorted = points.map((p) => p.value).sort((a, b) => a - b);
  const quantile = (q: number): number => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;

  const out = points.filter((p) => p.value < low || p.value > high);
  out.sort((a, b) => a.value - b.value || a.rowId.localeCompare(b.rowId));
  return out;
}

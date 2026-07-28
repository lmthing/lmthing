/**
 * Descriptive statistics for one column of one table's rows — pure, deterministic, never throws.
 *
 * Only NON-EMPTY values count (null/undefined/empty string are absent data, not zeros). If fewer
 * than half of those non-empty values parse as finite numbers, the column is not numeric and the
 * function refuses to summarize it: `{ count: 0, min: null, max: null, mean: null, median: null,
 * sum: null }`. That empty shape is a real answer ("this column doesn't hold numbers") — the caller
 * must report it, never substitute a guess.
 *
 * Self-contained by design: `toNumber` is duplicated locally because space functions are injected
 * standalone and cannot call each other.
 *
 * @param rows    The table's rows (as from `db.query(table)`).
 * @param column  The column to summarize.
 * @returns `{ count, min, max, mean, median, sum }` — every statistic rounded to 2 decimals, or the
 *          all-null shape when the column is missing, empty or non-numeric.
 */
export function summarizeNumericColumn(
  rows: Record<string, unknown>[] | null | undefined,
  column: string,
): { count: number; min: number | null; max: number | null; mean: number | null; median: number | null; sum: number | null } {
  const EMPTY = { count: 0, min: null, max: null, mean: null, median: null, sum: null };

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (s === '' || !/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const round2 = (n: number): number => Math.round(n * 100) / 100;

  if (!Array.isArray(rows) || typeof column !== 'string' || column === '') return EMPTY;

  const values = rows
    .filter((r) => r && typeof r === 'object')
    .map((r) => r[column])
    .filter((v) => v !== null && v !== undefined && v !== '');
  if (values.length === 0) return EMPTY;

  const nums: number[] = [];
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) nums.push(n);
  }
  // Majority rule: a column that is mostly prose with a stray number is not a numeric column.
  if (nums.length === 0 || nums.length * 2 < values.length) return EMPTY;

  const sorted = nums.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    count: sorted.length,
    min: round2(sorted[0]),
    max: round2(sorted[sorted.length - 1]),
    mean: round2(sum / sorted.length),
    median: round2(median),
    sum: round2(sum),
  };
}

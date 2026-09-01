/**
 * Sum one bound column set over one calendar period — pure, deterministic, never throws.
 *
 * A row counts when its `dateColumn` parses into `[periodStartIso, periodEndIso)` on UTC
 * calendar-day boundaries (start inclusive, end exclusive — so a month range is exactly its
 * days). When `dateColumn` is `null` the binding has no date at all: EVERY row is included and
 * `undated: true` is returned, so the caller can label the report "all rows, no period filter"
 * instead of pretending it closed a month.
 *
 * Amount parsing is thousand-separator tolerant. The LAST separator decides the decimal point —
 * `'1,234.5'` and `'1.234,5'` both yield `1234.5` — except when exactly three digits follow the
 * only kind of separator present (`'1,234'`, `'1.234'`, `'1,234,567'`), which is thousands
 * grouping. Currency symbols and spaces are stripped; `(12.50)` is read as `-12.5`. A value that
 * does not parse is skipped, never guessed at.
 *
 * Self-contained by design: the local `parseAmount`/`parseDate` helpers are duplicated here
 * because space functions are injected standalone and cannot call each other.
 *
 * @param rows            The bound table's rows (as from `db.query(table)`).
 * @param amountColumn    Column holding the money value.
 * @param dateColumn      Column holding the date, or `null` for an undated binding.
 * @param categoryColumn  Optional column holding the category label.
 * @param periodStartIso  Inclusive period start (`YYYY-MM-DD` or ISO instant).
 * @param periodEndIso    Exclusive period end (`YYYY-MM-DD` or ISO instant).
 * @returns `{ total, count, undated, byCategory }` — `total` and each category total rounded to
 *          2dp, uncategorized rows bucketed as `'uncategorized'`. Malformed input degrades to
 *          `{ total: 0, count: 0, undated: false, byCategory: {} }`.
 */
export function summarizePeriod(
  rows: Record<string, unknown>[] | null | undefined,
  amountColumn: string,
  dateColumn: string | null | undefined,
  categoryColumn: string | null | undefined,
  periodStartIso: string,
  periodEndIso: string,
): { total: number; count: number; undated: boolean; byCategory: Record<string, { total: number; count: number }> } {
  const EMPTY = { total: 0, count: 0, undated: false, byCategory: {} as Record<string, { total: number; count: number }> };

  const parseAmount = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    let s = value.trim();
    if (s === '') return null;
    let sign = 1;
    if (/^\(.*\)$/.test(s)) {
      sign = -1;
      s = s.slice(1, -1);
    }
    s = s.replace(/[^0-9.,+-]/g, '');
    const signMatch = s.match(/^[+-]/);
    if (signMatch) {
      if (signMatch[0] === '-') sign = -sign;
      s = s.slice(1);
    }
    s = s.replace(/[+-]/g, '');
    if (s === '' || !/^[0-9]/.test(s)) return null;
    const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    let normalized: string;
    if (lastSep === -1) {
      normalized = s;
    } else {
      const head = s.slice(0, lastSep).replace(/[.,]/g, '');
      const tail = s.slice(lastSep + 1);
      if (!/^\d+$/.test(tail) || !/^\d*$/.test(head)) return null;
      const distinctSeps = (s.includes(',') ? 1 : 0) + (s.includes('.') ? 1 : 0);
      const grouping = distinctSeps === 1 && tail.length === 3;
      normalized = grouping ? `${head}${tail}` : `${head === '' ? '0' : head}.${tail}`;
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? sign * n : null;
  };

  const parseDate = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      if (value >= 1e11 && value < 1e14) return new Date(value).toISOString();
      if (value >= 1e8 && value < 1e11) return new Date(value * 1000).toISOString();
      return null;
    }
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) return parseDate(Number(s));
    const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!dateShape.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  if (!Array.isArray(rows) || typeof amountColumn !== 'string' || amountColumn === '') return EMPTY;

  const undated = typeof dateColumn !== 'string' || dateColumn === '';
  const DAY = 86_400_000;
  let startDay = 0;
  let endDay = 0;
  if (!undated) {
    const startT = Date.parse(parseDate(periodStartIso) ?? '');
    const endT = Date.parse(parseDate(periodEndIso) ?? '');
    if (Number.isNaN(startT) || Number.isNaN(endT)) return EMPTY;
    startDay = Math.floor(startT / DAY);
    endDay = Math.floor(endT / DAY);
  }

  let total = 0;
  let count = 0;
  const byCategory: Record<string, { total: number; count: number }> = {};

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (!undated) {
      const at = parseDate(row[dateColumn as string]);
      if (at === null) continue;
      const day = Math.floor(Date.parse(at) / DAY);
      if (day < startDay || day >= endDay) continue; // [start, end)
    }
    const amount = parseAmount(row[amountColumn]);
    if (amount === null) continue;
    total += amount;
    count += 1;
    const rawCategory = typeof categoryColumn === 'string' && categoryColumn !== '' ? row[categoryColumn] : undefined;
    const category =
      rawCategory === null || rawCategory === undefined || String(rawCategory).trim() === ''
        ? 'uncategorized'
        : String(rawCategory).trim().slice(0, 120);
    const bucket = byCategory[category] ?? { total: 0, count: 0 };
    bucket.total += amount;
    bucket.count += 1;
    byCategory[category] = bucket;
  }

  const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
  for (const key of Object.keys(byCategory)) byCategory[key].total = round2(byCategory[key].total);
  return { total: round2(total), count, undated, byCategory };
}

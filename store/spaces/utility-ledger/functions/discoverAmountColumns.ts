/**
 * Discover money columns — an (amount, date, category) column set per table — pure, never throws.
 *
 * A candidate needs BOTH signals: a money-ish NAME (`amount`, `price`, `cost`, `total`, `fee`,
 * `paid`, `balance`, `spend`, `expense`, `income`, `budget`) and, when the table has sampled
 * values, a numeric parse rate `>= 0.8` over non-empty values. Columns that are structurally not
 * money are excluded outright: ids (`^id$`, `*_id`), counters (`count`, `qty`, `quantity`) and
 * calendar parts (`year`, `month`, `day`), plus the usual bookkeeping timestamps.
 *
 * For each surviving amount column the best sibling DATE column is picked (date-like
 * classification mirrored from `utility-deadlines`' `discoverDateColumns`) and an optional
 * CATEGORY column (`category`/`type`/`kind`/`tag`, holding strings). `direction` is read off the
 * amount column's own name — money semantics live in the name, not in the numbers.
 *
 * Confidence (deterministic, documented in `knowledge/ledger/binding.md`):
 *   `0.5 + 0.4 * numericRate + (dateColumn ? 0.1 : -0.2)`, clamped to [0, 1] and rounded to 2dp.
 * A money column with no date sibling therefore lands below 0.8 and is persisted as `proposed`:
 * you can still bind it, but nobody closes a period on it without a human saying so.
 *
 * Self-contained by design: the local `parseAmount`/`parseDate` helpers are duplicated here
 * because space functions are injected standalone and cannot call each other.
 *
 * @param tables  The `db.tables()` listing — tolerated shapes: `[{ name, columns?: [{name} |
 *                string] }]` or a plain `string[]` (then columns come from the samples).
 * @param samples `{ [tableName]: rows[] }` — up to ~20 sampled rows per table.
 * @returns `{ table, amountColumn, dateColumn, categoryColumn, direction, confidence }[]` sorted
 *          by confidence desc, then table, then amountColumn. Malformed input → `[]`.
 */
export function discoverAmountColumns(
  tables: unknown,
  samples: Record<string, Record<string, unknown>[]> | null | undefined,
): {
  table: string;
  amountColumn: string;
  dateColumn: string | null;
  categoryColumn: string | null;
  direction: 'expense' | 'income' | 'unknown';
  confidence: number;
}[] {
  // --- local helpers (duplicated on purpose — no sibling-function calls) ---------------------

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
      // Exactly three digits after the only kind of separator present is thousands grouping
      // ('1,234' / '1,234,567'); otherwise the LAST separator is the decimal point
      // ('1,234.5' and '1.234,5' both → 1234.5).
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

  const AMOUNT_HINT = /(amount|price|cost|total|fee|paid|balance|spend|expense|income|budget)/i;
  const AMOUNT_EXCLUDE = /(^id$|_id$|count|qty|quantity|year|month|day)/i;
  const BOOKKEEPING = /^(created_?at|updated_?at|deleted_?at|inserted_?at|modified_?at)$/i;
  const DATE_HINT = /(_at$|_on$|^date|date$|due|expir|deadline|until|start|end|valid_|posted|paid_at|period)/i;
  const CATEGORY_HINT = /(category|type|kind|tag)/i;

  // --- normalize the schema listing ----------------------------------------------------------

  const tableList: { name: string; columns: string[] }[] = [];
  if (Array.isArray(tables)) {
    for (const t of tables) {
      if (typeof t === 'string') tableList.push({ name: t, columns: [] });
      else if (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string') {
        const cols = Array.isArray((t as { columns?: unknown[] }).columns)
          ? (t as { columns: unknown[] }).columns
              .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name))
              .filter((c): c is string => typeof c === 'string')
          : [];
        tableList.push({ name: (t as { name: string }).name, columns: cols });
      }
    }
  }

  const out: {
    table: string;
    amountColumn: string;
    dateColumn: string | null;
    categoryColumn: string | null;
    direction: 'expense' | 'income' | 'unknown';
    confidence: number;
  }[] = [];

  for (const t of tableList) {
    const rows = Array.isArray(samples?.[t.name]) ? samples![t.name] : [];
    const cols = new Set<string>(t.columns);
    for (const r of rows.slice(0, 50)) {
      if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
    }
    const columns = [...cols];
    const valuesOf = (col: string): unknown[] =>
      rows
        .map((r) => (r && typeof r === 'object' ? r[col] : undefined))
        .filter((v) => v !== null && v !== undefined && v !== '');

    // Best date sibling for this table (shared by every amount column in it).
    let dateColumn: string | null = null;
    let dateScore = 0;
    for (const col of columns) {
      if (BOOKKEEPING.test(col)) continue;
      const values = valuesOf(col);
      const parseRate = values.length > 0 ? values.filter((v) => parseDate(v) !== null).length / values.length : 0;
      const nameSignal = DATE_HINT.test(col) ? 1 : 0;
      if (nameSignal === 0 && parseRate < 0.6) continue;
      if (values.length > 0 && parseRate === 0) continue;
      const score = 0.5 * nameSignal + 0.5 * parseRate;
      if (score > dateScore || (score === dateScore && dateColumn !== null && col.localeCompare(dateColumn) < 0)) {
        dateScore = score;
        dateColumn = col;
      }
    }

    // Best category sibling: name hint + string-valued.
    let categoryColumn: string | null = null;
    for (const col of columns) {
      if (!CATEGORY_HINT.test(col) || BOOKKEEPING.test(col)) continue;
      const values = valuesOf(col);
      const stringRate = values.length > 0 ? values.filter((v) => typeof v === 'string').length / values.length : 1;
      if (stringRate < 0.6) continue;
      if (categoryColumn === null || col.localeCompare(categoryColumn) < 0) categoryColumn = col;
    }

    for (const col of columns) {
      if (!AMOUNT_HINT.test(col)) continue;
      if (AMOUNT_EXCLUDE.test(col) || BOOKKEEPING.test(col)) continue;
      const values = valuesOf(col);
      const numericRate = values.length > 0 ? values.filter((v) => parseAmount(v) !== null).length / values.length : 0;
      if (values.length > 0 && numericRate < 0.8) continue; // named like money, doesn't hold money
      const direction: 'expense' | 'income' | 'unknown' = /(cost|fee|paid|spend|expense)/i.test(col)
        ? 'expense'
        : /(income|revenue)/i.test(col)
          ? 'income'
          : 'unknown';
      const raw = 0.5 + 0.4 * numericRate + (dateColumn ? 0.1 : -0.2);
      const confidence = Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
      if (confidence <= 0) continue;
      out.push({ table: t.name, amountColumn: col, dateColumn, categoryColumn, direction, confidence });
    }
  }

  out.sort(
    (a, b) => b.confidence - a.confidence || a.table.localeCompare(b.table) || a.amountColumn.localeCompare(b.amountColumn),
  );
  return out;
}

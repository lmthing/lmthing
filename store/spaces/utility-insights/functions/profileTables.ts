/**
 * Profile a project's tables from a schema listing plus sampled rows — pure, never throws.
 *
 * For every table it reports the sampled row count and, per column, three independent rates over
 * the NON-EMPTY sampled values:
 *  - `fillRate`    — share of sampled ROWS whose value is present (not null/undefined/empty string);
 *  - `numericRate` — share of non-empty values that parse as a finite number;
 *  - `dateRate`    — share of non-empty values that parse as a date.
 * All three are rounded to 2 decimals. The rates are independent by design: an epoch column can be
 * both numeric and date-like, and that ambiguity is information the analyst should see, not hide.
 *
 * Self-contained by design: the local `toNumber`/`toDate` helpers are duplicated here because space
 * functions are injected standalone and cannot call each other.
 *
 * @param tables   The `db.tables()` listing — tolerated shapes: `[{ name, columns?: [{name} |
 *                 string] }]` or a plain `string[]` of table names (then columns come from samples).
 * @param samples  `{ [tableName]: rows[] }` — sampled rows per table (up to ~50 are inspected).
 * @returns One entry per table, sorted by table name, columns sorted by column name:
 *          `{ table, rowCount, columns: { name, fillRate, numericRate, dateRate }[] }[]`.
 *          Malformed input degrades to `[]`.
 */
export function profileTables(
  tables: unknown,
  samples: Record<string, Record<string, unknown>[]> | null | undefined,
): { table: string; rowCount: number; columns: { name: string; fillRate: number; numericRate: number; dateRate: number }[] }[] {
  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (s === '' || !/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const toDate = (value: unknown): string | null => {
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
    if (/^\d+$/.test(s)) return toDate(Number(s));
    const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!dateShape.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  const round2 = (n: number): number => Math.round(n * 100) / 100;

  // Normalize the tables listing into { name, columns[] } records — same tolerance as the sibling
  // discovery functions: array of names, or array of { name, columns }.
  const tableList: { name: string; columns: string[] }[] = [];
  if (Array.isArray(tables)) {
    for (const t of tables) {
      if (typeof t === 'string') tableList.push({ name: t, columns: [] });
      else if (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string') {
        const cols = Array.isArray((t as { columns?: unknown[] }).columns)
          ? ((t as { columns: unknown[] }).columns
              .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name))
              .filter((c): c is string => typeof c === 'string'))
          : [];
        tableList.push({ name: (t as { name: string }).name, columns: cols });
      }
    }
  }

  const out: { table: string; rowCount: number; columns: { name: string; fillRate: number; numericRate: number; dateRate: number }[] }[] = [];
  for (const t of tableList) {
    const all = Array.isArray(samples?.[t.name]) ? samples![t.name] : [];
    const rows = all.filter((r) => r && typeof r === 'object');
    // Column universe = declared columns ∪ keys seen in the sample.
    const cols = new Set<string>(t.columns);
    for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) cols.add(k);

    const columns: { name: string; fillRate: number; numericRate: number; dateRate: number }[] = [];
    for (const col of Array.from(cols).sort()) {
      const values = rows
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined && v !== '');
      const numeric = values.filter((v) => toNumber(v) !== null).length;
      const dated = values.filter((v) => toDate(v) !== null).length;
      columns.push({
        name: col,
        fillRate: rows.length > 0 ? round2(values.length / rows.length) : 0,
        numericRate: values.length > 0 ? round2(numeric / values.length) : 0,
        dateRate: values.length > 0 ? round2(dated / values.length) : 0,
      });
    }
    out.push({ table: t.name, rowCount: rows.length, columns });
  }
  out.sort((a, b) => a.table.localeCompare(b.table));
  return out;
}

/**
 * Classify schedule-bearing columns from a schema listing plus sampled rows — pure, never throws.
 *
 * Two independent signals, combined (same scoring as a date-column classifier):
 *  - name heuristics: `*_at`, `*_on`, `date*`, `due*`, `expiry`/`expires`, `deadline`, `until`,
 *    `start`/`end`, `valid_*`, `renew*`, `birthday`/`dob` (0.5 weight);
 *  - value parse rate: the share of non-empty sampled values that parse as dates (0.5 weight).
 * A column with no name signal AND parse rate < 0.6 is not a candidate at all.
 *
 * Unlike a pure deadline watcher this KEEPS `start`/`end` columns — a planner wants the whole range,
 * not just the due date — and tags every candidate with a `kind` derived from its name:
 * `range-start` (`start…`), `range-end` (`end…`, `…until`), `deadline` (`due`, `deadline`, `expir`),
 * otherwise `event`. Bookkeeping columns (`createdAt`, `updated_at`, `deletedAt`, `insertedAt`,
 * `modifiedAt`) are excluded — they timestamp record-keeping, not plans — and so is this space's own
 * `planner_bindings` table.
 *
 * Self-contained by design: the local `parse` mirrors a lenient ISO/epoch date parser (space
 * functions are injected standalone, so sibling functions cannot call each other).
 *
 * @param tables   The `db.tables()` listing — tolerated shapes: `[{ name, columns?: [{name} |
 *                 string] }]` or plain `string[]` of table names (then columns come from samples).
 * @param samples  `{ [tableName]: rows[] }` — sampled rows per table (up to ~50 are inspected).
 * @returns Candidates sorted by confidence desc, then table, then column:
 *          `{ table, column, kind, confidence, parseRate, nameSignal, sampleSize }[]`. Degrades `[]`.
 */
export function discoverScheduleColumns(
  tables: unknown,
  samples: Record<string, Record<string, unknown>[]> | null | undefined,
): { table: string; column: string; kind: string; confidence: number; parseRate: number; nameSignal: boolean; sampleSize: number }[] {
  const parse = (value: unknown): string | null => {
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
    if (/^\d+$/.test(s)) return parse(Number(s));
    const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!dateShape.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  const NAME_HINT = /(_at$|_on$|^date|date$|due|expir|deadline|until|start|end|valid_|renew|birthday|^dob$)/i;
  const BOOKKEEPING = /^(created_?at|updated_?at|deleted_?at|inserted_?at|modified_?at)$/i;
  const OWN_TABLE = 'planner_bindings';

  // camelCase → snake_case before matching, so `startsAt` and `eventEndAt` classify like their
  // snake_case twins.
  const kindOf = (column: string): string => {
    const c = column.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (/(^|_)start/.test(c)) return 'range-start';
    if (/(^|_)end|(^|_)until/.test(c)) return 'range-end';
    if (/due|deadline|expir/.test(c)) return 'deadline';
    return 'event';
  };

  // Normalize the tables listing into { name, columns[] } records.
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

  const out: { table: string; column: string; kind: string; confidence: number; parseRate: number; nameSignal: boolean; sampleSize: number }[] = [];
  for (const t of tableList) {
    if (t.name === OWN_TABLE) continue; // never bind the planner to its own bindings
    const all = Array.isArray(samples?.[t.name]) ? samples![t.name] : [];
    const rows = all.filter((r) => r && typeof r === 'object');
    // Column universe = declared columns ∪ keys seen in samples.
    const cols = new Set<string>(t.columns);
    for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) cols.add(k);

    for (const col of cols) {
      if (BOOKKEEPING.test(col)) continue;
      const nameSignal = NAME_HINT.test(col);
      const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '');
      const parsed = values.filter((v) => parse(v) !== null).length;
      const parseRate = values.length > 0 ? parsed / values.length : 0;
      // No name signal and weak value evidence → not a candidate. With no sampled values at all, a
      // name signal alone still qualifies (an empty table should still get a proposed binding).
      if (!nameSignal && parseRate < 0.6) continue;
      if (values.length > 0 && parseRate === 0) continue; // name looks date-ish but values never parse
      const confidence = Math.round((0.5 * (nameSignal ? 1 : 0) + 0.5 * parseRate) * 100) / 100;
      if (confidence <= 0) continue;
      out.push({
        table: t.name,
        column: col,
        kind: kindOf(col),
        confidence,
        parseRate: Math.round(parseRate * 100) / 100,
        nameSignal,
        sampleSize: values.length,
      });
    }
  }
  out.sort((a, b) => b.confidence - a.confidence || a.table.localeCompare(b.table) || a.column.localeCompare(b.column));
  return out;
}

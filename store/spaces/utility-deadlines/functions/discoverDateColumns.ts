/**
 * Classify date-like columns from a schema listing plus sampled rows — pure, never throws.
 *
 * Two independent signals, combined:
 *  - name heuristics: `*_at`, `*_on`, `date*`, `due*`, `expiry`/`expires`, `deadline`, `until`,
 *    `start`/`end`, `valid_*`, `renew*`, `birthday`/`dob` (0.5 weight);
 *  - value parse rate: the share of non-empty sampled values that parse as dates (0.5 weight).
 * A column with no name signal AND parse rate < 0.6 is not a candidate at all. Columns that are
 * clearly bookkeeping (`createdAt`, `updatedAt`, `created_at`, `updated_at`, `deletedAt`,
 * `insertedAt`) are excluded — they are timestamps of record-keeping, not deadlines.
 *
 * Self-contained by design: the local `parse` mirrors `parseDateValue` (space functions are
 * injected standalone, so sibling functions cannot call each other).
 *
 * @param tables   The `db.tables()` listing — tolerated shapes: `[{ name, columns?: [{name} |
 *                 string] }]` or plain `string[]` of table names (then columns come from samples).
 * @param samples  `{ [tableName]: rows[] }` — up to ~20 sampled rows per table.
 * @returns Candidates sorted by confidence desc:
 *          `{ table, column, confidence, parseRate, nameSignal, sampleSize }[]`
 */
export function discoverDateColumns(
  tables: unknown,
  samples: Record<string, Record<string, unknown>[]> | null | undefined,
): { table: string; column: string; confidence: number; parseRate: number; nameSignal: boolean; sampleSize: number }[] {
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

  const out: { table: string; column: string; confidence: number; parseRate: number; nameSignal: boolean; sampleSize: number }[] = [];
  for (const t of tableList) {
    const rows = Array.isArray(samples?.[t.name]) ? samples![t.name] : [];
    // Column universe = declared columns ∪ keys seen in samples.
    const cols = new Set<string>(t.columns);
    for (const r of rows.slice(0, 50)) {
      if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
    }
    for (const col of cols) {
      if (BOOKKEEPING.test(col)) continue;
      const nameSignal = NAME_HINT.test(col);
      const values = rows.map((r) => (r && typeof r === 'object' ? r[col] : undefined))
        .filter((v) => v !== null && v !== undefined && v !== '');
      const parsed = values.filter((v) => parse(v) !== null).length;
      const parseRate = values.length > 0 ? parsed / values.length : 0;
      // No name signal and weak value evidence → not a candidate. With no sampled values at all,
      // a name signal alone still qualifies (empty tables should still get a proposed watcher).
      if (!nameSignal && parseRate < 0.6) continue;
      if (values.length > 0 && parseRate === 0) continue; // name looks date-ish but values never parse
      const confidence = Math.round((0.5 * (nameSignal ? 1 : 0) + 0.5 * parseRate) * 100) / 100;
      if (confidence <= 0) continue;
      out.push({ table: t.name, column: col, confidence, parseRate: Math.round(parseRate * 100) / 100, nameSignal, sampleSize: values.length });
    }
  }
  out.sort((a, b) => b.confidence - a.confidence || a.table.localeCompare(b.table) || a.column.localeCompare(b.column));
  return out;
}

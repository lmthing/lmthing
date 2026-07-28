/**
 * Propose data-contract rules from observed evidence — pure, conservative, never throws.
 *
 * The doctrine: **a rule is only suggested when the sample proves it.** A table with fewer than 10
 * sampled rows yields NOTHING at all — small samples make confident-looking nonsense. Every
 * suggestion carries an `evidence` string stating exactly what was observed, so a human reviewing
 * it can check the claim instead of trusting the machine.
 *
 * What is proposed:
 *  - `required`  — the column is non-empty in 100% of sampled rows.
 *  - `enum`      — a string column with between 1 and 6 distinct non-empty values.
 *  - `range`     — a numeric column, with the observed [min, max] widened by 50% of the span on
 *                  each side (a flat column widens by 50% of |value|), so normal drift is not a
 *                  violation.
 *  - `reference` — a column named `<name>_id` / `<name>Id` where a table matching `<name>`
 *                  (singular or plural) exists in the listing.
 *
 * The `id` column is never proposed for `required`/`enum`/`range` — a primary key is not a contract
 * worth queueing violations about.
 *
 * Self-contained by design: space functions are injected standalone, so nothing is imported.
 *
 * @param tables  The `db.tables()` listing — tolerated shapes: `[{ name, columns?: [{name}|string] }]`
 *                or a plain `string[]` of names (columns then come from the samples).
 * @param samples `{ [tableName]: rows[] }` — the sampled rows per table.
 * @returns `{ targetTable, column, kind, config, evidence }[]`, sorted by (table, column, kind).
 *          Malformed input degrades to `[]`.
 */
export function suggestRules(
  tables: unknown,
  samples: Record<string, Record<string, unknown>[]> | null | undefined,
): { targetTable: string; column: string; kind: string; config: Record<string, unknown>; evidence: string }[] {
  const MIN_ROWS = 10;
  const MAX_ENUM = 6;

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
  if (tableList.length === 0) return [];

  const names = tableList.map((t) => t.name);
  const parentFor = (col: string): string | undefined => {
    const base = col.replace(/(_id|Id)$/, '').toLowerCase();
    if (base === '') return undefined;
    return names.find((n) => {
      const l = n.toLowerCase();
      return l === base || l === `${base}s` || `${l}s` === base;
    });
  };
  const round = (n: number): number => Math.round(n * 1e6) / 1e6;

  const out: { targetTable: string; column: string; kind: string; config: Record<string, unknown>; evidence: string }[] = [];

  for (const t of tableList) {
    const rows = Array.isArray(samples?.[t.name]) ? samples![t.name].filter((r) => r && typeof r === 'object') : [];
    if (rows.length < MIN_ROWS) continue; // not enough evidence — propose nothing at all

    const cols = new Set<string>(t.columns);
    for (const r of rows) for (const k of Object.keys(r)) cols.add(k);

    for (const col of cols) {
      const values = rows.map((r) => r[col]);
      const present = values.filter((v) => !(v === null || v === undefined || (typeof v === 'string' && v.trim() === '')));

      // reference — structural, independent of fill rate
      const parent = /(_id|Id)$/.test(col) && col !== 'id' ? parentFor(col) : undefined;
      if (parent) {
        out.push({
          targetTable: t.name, column: col, kind: 'reference', config: { table: parent },
          evidence: `${col} looks like a foreign key and a table named ${parent} exists`,
        });
      }

      if (col === 'id') continue; // the primary key is not a contract worth queueing

      if (present.length === rows.length) {
        out.push({
          targetTable: t.name, column: col, kind: 'required', config: {},
          evidence: `non-empty in all ${rows.length} sampled rows`,
        });
      }

      if (present.length === 0) continue;

      const allStrings = present.every((v) => typeof v === 'string');
      if (allStrings && !parent) {
        const distinct = Array.from(new Set(present.map((v) => String(v))));
        if (distinct.length >= 1 && distinct.length <= MAX_ENUM) {
          distinct.sort();
          out.push({
            targetTable: t.name, column: col, kind: 'enum', config: { values: distinct },
            evidence: `only ${distinct.length} distinct values across ${present.length} sampled rows`,
          });
        }
      }

      const numbers = present
        .map((v) => (typeof v === 'number' ? v : Number(String(v).trim())))
        .filter((n) => Number.isFinite(n));
      if (!parent && numbers.length === present.length && present.every((v) => typeof v === 'number')) {
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const span = max - min;
        const margin = span > 0 ? span * 0.5 : Math.abs(max) * 0.5;
        out.push({
          targetTable: t.name, column: col, kind: 'range',
          config: { min: round(min - margin), max: round(max + margin) },
          evidence: `observed ${round(min)}..${round(max)} across ${present.length} sampled rows, widened by 50%`,
        });
      }
    }
  }

  out.sort(
    (a, b) =>
      a.targetTable.localeCompare(b.targetTable) || a.column.localeCompare(b.column) || a.kind.localeCompare(b.kind),
  );
  return out;
}

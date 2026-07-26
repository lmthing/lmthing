/**
 * Column-level diff between two versions of a row — pure, never throws.
 *
 * Compares the UNION of both objects' keys (a column that appeared or disappeared is a change,
 * not an invisible one) using canonical serialization for equality, so nested objects and arrays
 * compare by value and key insertion order never registers as a change.
 *
 * Values are reported verbatim — the diff never summarizes, rounds or paraphrases a cell; a
 * missing key is reported as `null`.
 *
 * Self-contained by design: the local `stringify` duplicates `stableStringify` because space
 * functions are injected standalone and cannot call each other.
 *
 * @param before  The previously snapshotted row.
 * @param after   The current row.
 * @returns `{ changedColumns, details }` — `changedColumns` sorted, `details[col] = { before,
 *          after }`. Malformed input degrades to `{ changedColumns: [], details: {} }`.
 */
export function diffRows(
  before: unknown,
  after: unknown,
): { changedColumns: string[]; details: Record<string, { before: unknown; after: unknown }> } {
  const stringify = (value: unknown): string => {
    const path = new Set<unknown>();
    const walk = (v: unknown): string => {
      if (v === null || v === undefined) return 'null';
      const t = typeof v;
      if (t === 'boolean') return v ? 'true' : 'false';
      if (t === 'number') return Number.isFinite(v as number) ? String(v) : 'null';
      if (t === 'bigint') return JSON.stringify(String(v));
      if (t === 'string') return JSON.stringify(v);
      if (t === 'function' || t === 'symbol') return 'null';
      if (t !== 'object') return 'null';
      if (path.has(v)) return '"[cycle]"';
      path.add(v);
      try {
        if (v instanceof Date) {
          const ms = v.getTime();
          return Number.isNaN(ms) ? 'null' : JSON.stringify(v.toISOString());
        }
        if (Array.isArray(v)) return `[${v.map((entry) => walk(entry)).join(',')}]`;
        const obj = v as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${walk(obj[k])}`).join(',')}}`;
      } catch {
        return 'null';
      } finally {
        path.delete(v);
      }
    };
    try {
      return walk(value);
    } catch {
      return 'null';
    }
  };

  const empty = { changedColumns: [] as string[], details: {} as Record<string, { before: unknown; after: unknown }> };
  const isRow = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isRow(before) || !isRow(after)) return empty;

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changedColumns: string[] = [];
  const details: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const b = key in before ? before[key] : undefined;
    const a = key in after ? after[key] : undefined;
    if (stringify(b) === stringify(a)) continue;
    changedColumns.push(key);
    details[key] = { before: b === undefined ? null : b, after: a === undefined ? null : a };
  }
  return { changedColumns, details };
}

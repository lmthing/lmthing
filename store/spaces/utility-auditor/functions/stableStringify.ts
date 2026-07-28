/**
 * Deterministic JSON serialization — pure, never throws.
 *
 * The same value always produces the same string, whatever order its keys were inserted in:
 * object keys are sorted recursively, arrays keep their order (order IS data in an array).
 * This is the substrate of the whole audit: two rows are "the same" iff their stable strings are
 * equal, so an unstable serializer would report phantom changes every sweep.
 *
 * Total by construction — every input has an output:
 *  - `undefined`, functions, symbols → `'null'` (JSON has no undefined);
 *  - non-finite numbers (`NaN`, `Infinity`) → `'null'`, matching `JSON.stringify`;
 *  - `bigint` → its decimal string, quoted (`JSON.stringify` would throw);
 *  - `Date` → its ISO string, quoted;
 *  - a CYCLE → `'"[cycle]"'` at the point of recursion. Detection is path-based, so a value that
 *    legitimately appears twice in a tree is serialized twice, not mistaken for a cycle.
 *
 * @param value  Any value.
 * @returns A canonical JSON string.
 */
export function stableStringify(value: unknown): string {
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
}

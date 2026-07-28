/**
 * Content hash of one row — pure, deterministic, never throws.
 *
 * djb2-xor over the row's canonical serialization (object keys sorted recursively), returned as
 * lowercase hex. Two rows hash equal iff their content is equal regardless of key insertion order,
 * which is the contract the sweep relies on: `rowHash` differing from the stored snapshot IS the
 * definition of "this row changed".
 *
 * Self-contained by design: the local `stringify` duplicates `stableStringify` because space
 * functions are injected standalone and cannot call each other.
 *
 * @param row  Any row-shaped value (or anything else — malformed input still hashes).
 * @returns 8-character lowercase hex, e.g. `1f0a3c7d`.
 */
export function hashRow(row: unknown): string {
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

  const text = stringify(row);
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; // djb2-xor, kept in uint32
  }
  return h.toString(16).padStart(8, '0');
}

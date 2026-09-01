/**
 * Serialize one table's rows into a byte-identical snapshot — pure, never throws.
 *
 * Stability is the whole point: two snapshots of unchanged data must produce the SAME string, so a
 * diff between weeks means the data changed and nothing else. `JSON.stringify` does not promise
 * that (key order follows insertion order, which a database driver may vary), so keys are sorted
 * recursively; arrays keep their order, because in an array order IS data.
 *
 * A cycle serializes as `"[cycle]"` instead of throwing — a snapshot of odd data is still a
 * snapshot, and an archivist that crashes on one weird row protects nothing.
 *
 * @param rows The table's rows (as from `db.query(table)`).
 * @returns `{ rowCount, dataJson }`. Malformed input degrades to `{ rowCount: 0, dataJson: '[]' }`.
 */
export function buildTableSnapshot(
  rows: Record<string, unknown>[] | null | undefined,
): { rowCount: number; dataJson: string } {
  if (!Array.isArray(rows)) return { rowCount: 0, dataJson: '[]' };

  // Inlined stable stringifier — space functions are injected standalone, so nothing may be
  // imported or borrowed from a sibling function.
  const stable = (value: unknown, seen: unknown[]): string => {
    if (value === null || value === undefined) return 'null';
    const t = typeof value;
    if (t === 'number') return Number.isFinite(value as number) ? JSON.stringify(value) : 'null';
    if (t === 'boolean') return (value as boolean) ? 'true' : 'false';
    if (t === 'string') return JSON.stringify(value);
    if (t === 'bigint') return JSON.stringify(String(value));
    if (t === 'function' || t === 'symbol') return 'null';
    if (seen.indexOf(value) !== -1) return '"[cycle]"';
    const next = seen.concat([value]);
    if (Array.isArray(value)) return `[${value.map((v) => stable(v, next)).join(',')}]`;
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(obj[k], next)}`).join(',')}}`;
  };

  let dataJson: string;
  try {
    dataJson = stable(rows, []);
  } catch {
    return { rowCount: 0, dataJson: '[]' };
  }
  return { rowCount: rows.length, dataJson };
}

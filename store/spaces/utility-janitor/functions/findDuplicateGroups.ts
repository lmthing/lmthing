/**
 * Group rows that share the same normalized natural key — pure, never throws.
 *
 * Key values are normalized before comparison (trim, lowercase, collapse internal whitespace), so
 * `"  Ada  Lovelace "` and `"ada lovelace"` are the same person. Only groups with MORE THAN ONE
 * row are returned — a unique row is not a finding. Rows without a usable `id` are skipped (a row
 * that cannot be re-identified cannot be acted on), and rows whose key columns are all empty are
 * skipped too (absence of a value is not evidence of duplication).
 *
 * Self-contained by design: space functions are injected standalone, so nothing is imported and no
 * sibling function is called.
 *
 * @param rows        The table's rows (as from `db.query(table)`).
 * @param keyColumns  Column names forming the natural key, e.g. `['email']` or `['name','city']`.
 * @returns `{ key, rowIds }[]` sorted by key asc — `key` is the normalized composite (columns
 *          joined by `|`), `rowIds` the ids in first-seen order. Malformed input degrades to `[]`.
 */
export function findDuplicateGroups(
  rows: Record<string, unknown>[] | null | undefined,
  keyColumns: string[] | null | undefined,
): { key: string; rowIds: string[] }[] {
  const norm = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
  };

  if (!Array.isArray(rows) || !Array.isArray(keyColumns)) return [];
  const cols = keyColumns.filter((c): c is string => typeof c === 'string' && c !== '');
  if (cols.length === 0) return [];

  const groups = new Map<string, string[]>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rawId = (row as Record<string, unknown>)['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
    if (rowId === '') continue;
    const parts = cols.map((c) => norm((row as Record<string, unknown>)[c]));
    if (parts.every((p) => p === '')) continue; // empty keys are not duplicates of each other
    const key = parts.join('|');
    const bucket = groups.get(key);
    if (bucket) bucket.push(rowId);
    else groups.set(key, [rowId]);
  }

  const out: { key: string; rowIds: string[] }[] = [];
  for (const [key, rowIds] of groups) {
    if (rowIds.length > 1) out.push({ key, rowIds });
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

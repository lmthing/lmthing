/**
 * Stable dedupe identity for one imported row — pure, never throws.
 *
 * Built from the chosen natural-key columns, each normalized (trim, lowercase, collapse internal
 * whitespace) so `"  Ada Lovelace "` and `"ada lovelace"` are one person on re-import. Key columns
 * are used in the order given, and a missing value becomes an empty segment rather than shifting
 * the others — so the key shape is fixed for a given key-column choice.
 *
 * @returns e.g. `people:ada@example.com|ada_lovelace`
 */
export function computeImportRowKey(
  targetTable: unknown,
  row: Record<string, unknown> | null | undefined,
  keyColumns: unknown,
): string {
  const table = String(targetTable ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 80);
  const cols = Array.isArray(keyColumns) ? keyColumns.filter((c): c is string => typeof c === 'string') : [];
  if (cols.length === 0) return `${table}:`;

  const parts = cols.map((c) => {
    const v = row && typeof row === 'object' ? row[c] : undefined;
    return String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/\|/g, '/').slice(0, 120);
  });
  return `${table}:${parts.join('|')}`;
}

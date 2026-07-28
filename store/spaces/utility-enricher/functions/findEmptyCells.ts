/**
 * Find the blank cells worth researching — pure, never throws.
 *
 * A cell is "empty" when the column is missing from the row, or its value is `null`, `undefined`,
 * the empty string, or whitespace only. Everything else (0, false, an empty array) is a real value
 * and is left alone — an enricher that overwrites `0` is a data-loss bug, not an enrichment.
 *
 * A row without a usable `id` is skipped: a cell we cannot re-identify later can never be patched
 * back, so proposing research for it would only waste budget.
 *
 * @param rows    The table's rows (as from `db.query(table)`).
 * @param columns The columns the user asked to fill.
 * @returns `{ rowId, column }[]` in row order, then in the given column order. Malformed input
 *          degrades to `[]`.
 */
export function findEmptyCells(
  rows: Record<string, unknown>[] | null | undefined,
  columns: string[] | null | undefined,
): { rowId: string; column: string }[] {
  if (!Array.isArray(rows) || !Array.isArray(columns)) return [];
  const cols = columns.filter((c): c is string => typeof c === 'string' && c.trim() !== '');
  if (cols.length === 0) return [];

  const out: { rowId: string; column: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rawId = (row as Record<string, unknown>)['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : '';
    if (rowId === '') continue; // unidentifiable row: nothing could ever be applied back to it
    for (const column of cols) {
      const value = (row as Record<string, unknown>)[column];
      if (value === null || value === undefined) { out.push({ rowId, column }); continue; }
      if (typeof value === 'string' && value.trim() === '') { out.push({ rowId, column }); continue; }
    }
  }
  return out;
}

/**
 * Find rows whose foreign key points at a parent that does not exist — pure, never throws.
 *
 * A row is an orphan when its `fkColumn` holds a NON-EMPTY value that is absent from `parentIds`.
 * An empty/null foreign key is not an orphan (it is an unset optional relation), and a row without
 * a usable `id` is skipped — a row that cannot be re-identified cannot be acted on. Ids are
 * compared as strings so `42` and `"42"` match.
 *
 * No I/O: the caller loads the parent table's ids and passes them in.
 *
 * @param rows       The child table's rows (as from `db.query(table)`).
 * @param fkColumn   The foreign-key column, e.g. `customer_id`.
 * @param parentIds  Every id present in the parent table.
 * @returns `{ rowId, fkValue }[]` sorted by rowId. Malformed input degrades to `[]`.
 */
export function findOrphanRows(
  rows: Record<string, unknown>[] | null | undefined,
  fkColumn: string,
  parentIds: (string | number)[] | null | undefined,
): { rowId: string; fkValue: string }[] {
  if (!Array.isArray(rows) || typeof fkColumn !== 'string' || fkColumn === '') return [];
  const known = new Set<string>();
  if (Array.isArray(parentIds)) {
    for (const p of parentIds) {
      if (p === null || p === undefined) continue;
      if (typeof p === 'object') continue;
      known.add(String(p).trim());
    }
  }

  const out: { rowId: string; fkValue: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rawId = (row as Record<string, unknown>)['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
    if (rowId === '') continue;
    const raw = (row as Record<string, unknown>)[fkColumn];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'object') continue; // not a scalar key — not our call to judge
    const fkValue = String(raw).trim();
    if (fkValue === '') continue; // unset relation, not an orphan
    if (known.has(fkValue)) continue;
    out.push({ rowId, fkValue });
  }
  out.sort((a, b) => a.rowId.localeCompare(b.rowId));
  return out;
}

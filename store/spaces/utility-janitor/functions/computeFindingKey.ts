/**
 * Stable identity for one janitor finding — pure, never throws.
 *
 * Keyed on (table, rowId, kind, detail) so a re-scan of unchanged data re-produces exactly the same
 * key and the record step skips it. `detail` participates because one row can carry several
 * findings of the same kind (two columns needing normalization). Inputs are coerced to strings and
 * lightly sanitized, so even a malformed value yields a usable, stable key.
 *
 * @param targetTable Host-app table the finding is about.
 * @param rowId       The offending row's id (or the group key, for duplicate findings).
 * @param kind        `'duplicate' | 'normalize' | 'orphan'`.
 * @param detail      Short discriminator, e.g. the column name or the duplicate key.
 * @returns e.g. `customers:42:normalize:email`
 */
export function computeFindingKey(targetTable: unknown, rowId: unknown, kind: unknown, detail: unknown): string {
  const clean = (v: unknown): string =>
    String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/[:\s]+/g, '_')
      .slice(0, 120);
  return `${clean(targetTable)}:${clean(rowId)}:${clean(kind)}:${clean(detail)}`;
}

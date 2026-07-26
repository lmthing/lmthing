/**
 * Stable identity for one enrichment task — pure, never throws.
 *
 * Keyed on exactly what makes a task the same task: the target cell `(table, rowId, column)`.
 * There is no date in the key on purpose — re-running `plan` must never queue a second research
 * task for a cell that is already pending, proposed, rejected or applied. Research costs budget;
 * duplicates cost it twice for the same answer.
 *
 * Inputs are coerced and lightly sanitized, so a malformed value still yields a usable, stable key.
 *
 * @returns e.g. `landmarks:42:height_meters`
 */
export function computeEnrichKey(targetTable: unknown, rowId: unknown, column: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 120);
  return `${clean(targetTable)}:${clean(rowId)}:${clean(column)}`;
}

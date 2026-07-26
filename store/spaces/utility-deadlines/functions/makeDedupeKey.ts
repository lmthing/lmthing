/**
 * Stable identity for one deadline alert — pure, never throws.
 *
 * Keyed on the watched (table, rowId, column) plus the DATE (not time) the value resolves to, so
 * a sweep re-run never duplicates an alert, while a genuinely moved deadline (new date) correctly
 * produces a new alert. Inputs are coerced to strings and lightly sanitized so a malformed value
 * still yields a usable, stable key.
 *
 * @param table  Watched table name.
 * @param rowId  The row's id.
 * @param column Watched column name.
 * @param dueAt  The resolved due timestamp (ISO string); only its `YYYY-MM-DD` prefix is used.
 * @returns e.g. `documents:42:expiry_date:2026-08-01`
 */
export function makeDedupeKey(table: unknown, rowId: unknown, column: unknown, dueAt: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 120);
  const datePart = String(dueAt ?? '').slice(0, 10);
  return `${clean(table)}:${clean(rowId)}:${clean(column)}:${datePart}`;
}

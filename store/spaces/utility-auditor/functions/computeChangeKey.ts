/**
 * Stable identity for one audit_log entry — pure, never throws.
 *
 * Keyed on (table, rowId, change kind, sweep DAY). `sweepAt` is truncated to its `YYYY-MM-DD`
 * prefix deliberately: a sweep that is retried, resumed, or run twice in one day must not append
 * the same change twice, while the same row changing again on a LATER day is genuinely a new
 * entry. One row can still yield an `added` and a `removed` entry on the same day — the change
 * kind is part of the key.
 *
 * Inputs are coerced and lightly sanitized so a malformed id still yields a usable, stable key.
 *
 * @param targetTable  The audited table's name.
 * @param rowId        The row's id.
 * @param change       `'added' | 'changed' | 'removed'`.
 * @param sweepAt      The sweep instant (ISO string); only its date prefix is used.
 * @returns e.g. `invoices:42:changed:2026-07-26`
 */
export function computeChangeKey(targetTable: unknown, rowId: unknown, change: unknown, sweepAt: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 120);
  const dayPart = String(sweepAt ?? '').trim().slice(0, 10);
  return `${clean(targetTable)}:${clean(rowId)}:${clean(change)}:${dayPart}`;
}

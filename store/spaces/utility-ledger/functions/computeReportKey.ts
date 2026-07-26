/**
 * Stable identity for one monthly close — pure, never throws.
 *
 * Keyed on the binding plus the period START date only, so re-running `close` for the same month
 * (a retried cron, a manual re-run) finds the existing `ledger_reports` row and inserts nothing.
 * A different month is a different key, which is exactly one report row per binding per period.
 * Inputs are coerced and lightly sanitized so a malformed id still yields a usable, stable key.
 *
 * @param bindingId    The `ledger_bindings` row id.
 * @param periodStart  The period start (`YYYY-MM-DD` or ISO instant); only its date prefix is used.
 * @returns e.g. `7:2026-06-01`
 */
export function computeReportKey(bindingId: unknown, periodStart: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 120);
  const datePart = String(periodStart ?? '').trim().slice(0, 10);
  return `${clean(bindingId)}:${datePart}`;
}

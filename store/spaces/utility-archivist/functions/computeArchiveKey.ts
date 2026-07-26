/**
 * Stable identity for one snapshot or one report — pure, never throws.
 *
 * Keyed on `(kind, targetTable, day)` with the day truncated to `YYYY-MM-DD`, so a table gets at
 * most ONE snapshot and at most ONE report of each kind per day, no matter how often a cron fires,
 * a retry lands, or a user re-runs the action by hand. Snapshots are large rows; duplicates are the
 * expensive kind of mistake here.
 *
 * @param kind        'snapshot' | 'retention' | 'pii' (any string is accepted and sanitized).
 * @param targetTable The table the snapshot or report is about.
 * @param dayIso      An ISO date or datetime — only its `YYYY-MM-DD` prefix is used.
 * @returns e.g. `snapshot:orders:2026-07-26`
 */
export function computeArchiveKey(kind: unknown, targetTable: unknown, dayIso: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/[:\s]+/g, '_').slice(0, 120);
  const day = String(dayIso ?? '').trim().slice(0, 10);
  return `${clean(kind)}:${clean(targetTable)}:${day}`;
}

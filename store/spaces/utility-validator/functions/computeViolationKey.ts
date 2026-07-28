/**
 * Stable identity for one violation — pure, never throws.
 *
 * Keyed on (ruleId, table, rowId): the same rule failing the same row is the SAME violation, no
 * matter how many sweeps see it. That is what makes the daily check idempotent (check-before-insert
 * on the key) and what makes auto-resolution decidable — a key produced last sweep but not this one
 * means the row was fixed. Inputs are coerced and lightly sanitized so a malformed value still
 * yields a usable, stable key.
 *
 * @param ruleId      The `validation_rules` row id.
 * @param targetTable The table the rule guards.
 * @param rowId       The offending row's id.
 * @returns e.g. `7:orders:42`
 */
export function computeViolationKey(ruleId: unknown, targetTable: unknown, rowId: unknown): string {
  const clean = (v: unknown): string =>
    String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/[:\s]+/g, '_')
      .slice(0, 120);
  return `${clean(ruleId)}:${clean(targetTable)}:${clean(rowId)}`;
}

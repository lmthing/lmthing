/**
 * Stable identity for one delivered batch — pure, never throws.
 *
 * Keyed on the rule plus the watermark the batch STARTED from plus its size, so a re-run of the
 * same dispatch (same rule, same watermark, same rows) is recognized as already-sent, while the
 * next genuine batch — which starts from a later watermark — gets its own key.
 *
 * @returns e.g. `rule_7:2026-07-26T08:30:00.000Z:12`
 */
export function computeBatchKey(ruleId: unknown, lastSeenCreatedAt: unknown, itemCount: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').trim().replace(/\s+/g, '_').slice(0, 120);
  const count = Number.isFinite(Number(itemCount)) ? String(Number(itemCount)) : '0';
  return `${clean(ruleId)}:${clean(lastSeenCreatedAt) || 'genesis'}:${count}`;
}

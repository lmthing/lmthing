export type MacroTargetStatus = 'under' | 'on-track' | 'over';

/**
 * Classifies an actual macro value against a target as `'under'`, `'on-track'`, or `'over'`,
 * using a ±25% band (matching the kitchen app's own `kitchenStats` on-track threshold) so a day
 * that's close to target isn't flagged over a small, normal fluctuation. A missing or non-positive
 * `target` (nothing configured yet) is treated as `'on-track'` — there's nothing to be off-track
 * from until the household sets a real goal.
 */
export function macroTargetStatus(actual: number, target: number): MacroTargetStatus {
  if (!target || target <= 0) return 'on-track';

  const ratio = actual / target;
  if (ratio < 0.75) return 'under';
  if (ratio > 1.25) return 'over';
  return 'on-track';
}

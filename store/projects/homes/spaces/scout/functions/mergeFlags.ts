/**
 * Merge analysis flags into a listing's flag set — union, de-duplicated, order-
 * stable (severity-first so the UI renders the scariest chip first). The analyst
 * contributes flags per analysis; this folds them into `listings.flags` without
 * ever dropping an existing flag or double-listing one. Deterministic.
 *
 * Severity order groups the warning flags (mismatch/overstated/scam) ahead of the
 * softer condition flags so `FlagChips` can show the most important first.
 */
const SEVERITY: string[] = [
  'size_overstated',
  'photo_text_mismatch',
  'possible_duplicate',
  'fuzzed_pin',
  'poor_light',
  'dated_kitchen',
  'dated_bathroom',
  'ground_floor',
  'no_elevator',
  'north_facing',
  'busy_street',
];

export function mergeFlags(existing: string[] | undefined, incoming: string[] | undefined): string[] {
  const set = new Set<string>();
  for (const f of existing ?? []) if (f) set.add(f);
  for (const f of incoming ?? []) if (f) set.add(f);
  const all = Array.from(set);
  return all.sort((a, b) => {
    const ia = SEVERITY.indexOf(a);
    const ib = SEVERITY.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Which flags are "warnings" (rendered destructive) vs. soft condition notes. */
export function isWarningFlag(flag: string): boolean {
  return ['size_overstated', 'photo_text_mismatch', 'possible_duplicate', 'scam_signals'].includes(flag);
}

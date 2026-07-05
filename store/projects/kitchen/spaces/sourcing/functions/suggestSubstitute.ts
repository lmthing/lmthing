export type SubstitutionReason = 'out-of-stock' | 'expiring' | 'cost' | 'dietary';

export interface SubstituteSuggestion {
  substituteName: string;
  /** how much of the substitute replaces one unit of the original (e.g. butter→oil ≈ 0.75). */
  ratio: number;
  reason: SubstitutionReason;
  note: string;
}

/**
 * A small, deterministic swap table keyed by the normalized original ingredient. Ratios are the
 * common culinary conversions (amount of substitute per 1 unit of original). Kept intentionally
 * conservative — only well-known 1:~1 swaps — because a bad substitution is worse than none.
 */
const SWAP_TABLE: Record<string, Array<{ name: string; ratio: number; note: string }>> = {
  butter: [{ name: 'olive oil', ratio: 0.75, note: 'use ~¾ the amount; best for sautéing, not baking' }],
  milk: [{ name: 'oat milk', ratio: 1, note: 'plant milk, 1:1 in most savoury and baked uses' }],
  cream: [{ name: 'evaporated milk', ratio: 1, note: 'lighter; thicken with a little cornstarch if needed' }],
  sourcream: [{ name: 'plain yogurt', ratio: 1, note: '1:1; slightly tangier and thinner' }],
  egg: [{ name: 'ground flax + water', ratio: 1, note: '1 tbsp flax + 3 tbsp water per egg (binding only)' }],
  sugar: [{ name: 'honey', ratio: 0.75, note: 'use ~¾ and reduce other liquids slightly' }],
  breadcrumbs: [{ name: 'rolled oats', ratio: 1, note: '1:1 as a binder or coating' }],
};

function norm(name: string): string {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Suggest a substitute for an ingredient given WHY a swap is needed. Deterministic: looks the
 * original up in a conservative culinary swap table and returns the best-known replacement with its
 * conversion `ratio`, tagged with the caller's `reason`. Returns `null` when no safe swap is known
 * — the caller then leaves the item as-is rather than inventing a risky substitution. For a
 * `dietary` reason the caller is responsible for confirming the substitute doesn't reintroduce the
 * excluded allergen/diet conflict; this function never proposes a swap that is itself a common
 * allergen replacement for a stricter diet.
 */
export function suggestSubstitute(
  ingredientName: string,
  reason: SubstitutionReason,
): SubstituteSuggestion | null {
  const entry = SWAP_TABLE[norm(ingredientName)];
  if (!entry || entry.length === 0) return null;
  const best = entry[0]!;
  return { substituteName: best.name, ratio: best.ratio, reason, note: best.note };
}

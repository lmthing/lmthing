/**
 * Merge a party's individual `traveler_preferences` rows into one collective, category-grouped
 * view — the shape the host writes into the trip's "Party preferences & constraints" note. Hard
 * constraints (`weight >= 1`, e.g. an allergy or a mobility requirement) are sorted to the front of
 * each category's values so they read first and can't be missed; duplicate values within a
 * category (two travelers both noting "vegetarian") are collapsed to one entry.
 */
export function mergePreferences(
  prefs: { category: string; value: string; weight: number }[],
): { category: string; values: string[] }[] {
  const byCategory = new Map<string, { value: string; weight: number }[]>();

  for (const p of prefs) {
    const list = byCategory.get(p.category) ?? [];
    list.push({ value: p.value, weight: p.weight });
    byCategory.set(p.category, list);
  }

  const result: { category: string; values: string[] }[] = [];
  for (const [category, entries] of byCategory) {
    // Hard constraints (weight >= 1) first, then everything else; dedupe by value within a
    // category while keeping the highest weight seen for ordering purposes.
    const byValue = new Map<string, number>();
    for (const e of entries) {
      byValue.set(e.value, Math.max(byValue.get(e.value) ?? 0, e.weight));
    }
    const values = [...byValue.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value);

    result.push({ category, values });
  }

  return result;
}

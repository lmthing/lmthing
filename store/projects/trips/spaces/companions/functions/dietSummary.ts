/**
 * Produce a one-line diet constraint summary for the party from its `diet`-category preferences —
 * used by the host's `profile` action and folded into the party-wide note. Hard constraints
 * (allergies, medically-required restrictions — modelled here as any value containing "allerg" or
 * a caller-flagged hard constraint) always lead; softer preferences ("prefers vegetarian options")
 * follow. Returns a short human-readable string, never a fabricated restriction beyond what's in
 * `prefs`.
 */
export function dietSummary(prefs: { category: string; value: string }[]): string {
  const diet = prefs.filter((p) => p.category === 'diet');
  if (!diet.length) return 'No diet restrictions recorded.';

  const hard = diet.filter((p) => /allerg|intoleran|celiac|coeliac/i.test(p.value));
  const soft = diet.filter((p) => !/allerg|intoleran|celiac|coeliac/i.test(p.value));

  const parts: string[] = [];
  if (hard.length) parts.push(hard.map((p) => p.value).join('; '));
  if (soft.length) parts.push(soft.map((p) => p.value).join(', '));

  return parts.join(' — ');
}

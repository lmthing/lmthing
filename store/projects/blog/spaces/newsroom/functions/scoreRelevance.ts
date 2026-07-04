/**
 * A simple keyword-overlap relevance score: counts how many of the reader's interest terms appear
 * in the title (weighted 2x) or excerpt (1x), normalized to a 0..100 scale. This is a cheap
 * default for `articles.score` — not a substitute for the synthesizer's own editorial judgment of
 * what's actually worth surfacing.
 */
export function scoreRelevance(title: string, excerpt: string | undefined, interests: string[]): number {
  if (!interests || interests.length === 0) return 0;

  const titleLower = (title ?? '').toLowerCase();
  const excerptLower = (excerpt ?? '').toLowerCase();

  let hits = 0;
  for (const interest of interests) {
    const term = interest.trim().toLowerCase();
    if (!term) continue;
    if (titleLower.includes(term)) hits += 2;
    if (excerptLower.includes(term)) hits += 1;
  }

  const maxPossible = interests.length * 3; // every interest hit in both title (2) and excerpt (1)
  if (maxPossible === 0) return 0;

  return Math.round(Math.min(100, (hits / maxPossible) * 100));
}

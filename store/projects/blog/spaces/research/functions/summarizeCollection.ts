/**
 * Summarize a collection's membership: the item count and its top ~5 tags by frequency, tallied
 * across each member article's `tags`. Items with no article attached (e.g. a stale membership
 * whose article was removed) simply contribute no tags rather than being skipped from the count.
 */
export function summarizeCollection(
  items: { article?: { tags?: string[]; title?: string } }[],
): { count: number; topTags: string[] } {
  const tally = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.article?.tags ?? []) {
      tally.set(tag, (tally.get(tag) ?? 0) + 1);
    }
  }

  const topTags = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return { count: items.length, topTags };
}

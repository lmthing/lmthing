/**
 * Test whether an article matches a saved-search query — true when any of the query's `tags`
 * intersects the article's `tags`, or the query's `keyword` (case-insensitive) appears in the
 * article's `title`/`summary`. An empty or missing query never matches anything — a subscription
 * or smart collection with no real criteria yet should surface nothing rather than everything.
 */
export function matchSubscription(
  article: { title?: string; summary?: string; tags?: string[] },
  query: { tags?: string[]; keyword?: string; sources?: string[]; sourceId?: string } | null | undefined,
): boolean {
  if (!query) return false;

  const articleTags = article.tags ?? [];
  if (query.tags && query.tags.length > 0) {
    if (query.tags.some((tag) => articleTags.includes(tag))) return true;
  }

  if (query.keyword && query.keyword.trim()) {
    const keyword = query.keyword.trim().toLowerCase();
    const haystack = `${article.title ?? ''} ${article.summary ?? ''}`.toLowerCase();
    if (haystack.includes(keyword)) return true;
  }

  return false;
}

/**
 * Group articles by their primary topic (the first tag in `tags`), preserving each article's
 * original order within its cluster. Articles with no tags at all are filed under a catch-all
 * `'general'` cluster rather than dropped, so nothing goes unrepresented in a digest.
 */
export function clusterArticles<T extends { id: string; tags?: string[] }>(
  articles: T[],
): { topicSlug: string; articles: T[] }[] {
  const byTopic = new Map<string, T[]>();

  for (const article of articles) {
    const topicSlug = article.tags && article.tags.length > 0 ? article.tags[0] : 'general';
    const bucket = byTopic.get(topicSlug) ?? [];
    bucket.push(article);
    byTopic.set(topicSlug, bucket);
  }

  return Array.from(byTopic.entries()).map(([topicSlug, clusterArticlesList]) => ({
    topicSlug,
    articles: clusterArticlesList,
  }));
}

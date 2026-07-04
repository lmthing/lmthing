/**
 * Drop near-duplicate articles, keeping the first occurrence of each distinct story. Articles are
 * considered the same story when they share a `clusterKey` (the normalized grouping key the
 * synthesizer/curator assign); when `clusterKey` is missing on one or both sides, fall back to a
 * normalized (trimmed, lower-cased, whitespace-collapsed) comparison of `title`.
 */
export function dedupeArticles<T extends { id: string; clusterKey?: string; title?: string }>(
  articles: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const article of articles) {
    const key =
      article.clusterKey?.trim().toLowerCase() ||
      (article.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ') ||
      article.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

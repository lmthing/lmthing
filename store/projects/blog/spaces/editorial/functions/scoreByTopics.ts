/**
 * Score an article for personalization by summing the reader's current topic weights across the
 * article's tags. A tag with no matching `topics` row (the reader hasn't explicitly followed it
 * yet) contributes a neutral default weight of `1` rather than `0`, so untagged/unfamiliar topics
 * aren't unfairly buried before the reader has ever engaged with them.
 */
export function scoreByTopics(tags: string[], topicWeights: Record<string, number>): number {
  if (!tags || tags.length === 0) return 0;
  const total = tags.reduce((sum, tag) => sum + (topicWeights[tag] ?? 1), 0);
  return Math.round(total * 100) / 100;
}

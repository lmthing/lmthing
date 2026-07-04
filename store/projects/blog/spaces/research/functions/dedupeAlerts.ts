/**
 * Drop candidate alerts that already exist — either already raised (present in `existing`, by
 * `subscriptionId` + `articleId`) or duplicated within this same candidate batch — preserving the
 * order of first occurrence. Returns the full candidate objects that survive, so the caller can
 * insert them as-is.
 */
export function dedupeAlerts<T extends { subscriptionId: string; articleId: string }>(
  candidates: T[],
  existing: { subscriptionId: string; articleId: string }[],
): T[] {
  const seen = new Set<string>(existing.map((e) => `${e.subscriptionId}:${e.articleId}`));
  const result: T[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.subscriptionId}:${candidate.articleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

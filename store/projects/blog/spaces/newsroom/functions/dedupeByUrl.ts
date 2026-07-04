/**
 * Drop items whose `url` is already known (already recorded as a `raw_items` row) or duplicated
 * within this batch itself, preserving the order of first occurrence. `knownUrls` is treated as
 * read-only — a new internal set is used so the caller's set is never mutated.
 */
export function dedupeByUrl<T extends { url: string }>(items: T[], knownUrls: Set<string>): T[] {
  const seen = new Set<string>(knownUrls);
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }

  return result;
}

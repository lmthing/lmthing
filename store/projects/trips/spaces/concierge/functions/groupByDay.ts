/**
 * Group itinerary items by their `day`, sorting the day groups chronologically and the items
 * within each day by `startTime` (items with no `startTime` sort last within their day).
 */
export function groupByDay<T extends { day?: string; startTime?: string }>(
  items: T[],
): { day: string; items: T[] }[] {
  const byDay = new Map<string, T[]>();

  for (const item of items) {
    const day = item.day ?? '';
    const bucket = byDay.get(day) ?? [];
    bucket.push(item);
    byDay.set(day, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, dayItems]) => ({
      day,
      items: [...dayItems].sort((a, b) => {
        const at = a.startTime ?? '';
        const bt = b.startTime ?? '';
        if (!at && !bt) return 0;
        if (!at) return 1;
        if (!bt) return -1;
        return at < bt ? -1 : at > bt ? 1 : 0;
      }),
    }));
}

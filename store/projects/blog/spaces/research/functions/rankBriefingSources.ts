/**
 * Dedupe a candidate source list by `url` (keeping the highest-scored occurrence), sort by `score`
 * descending, and cap to the top 8 — a briefing should read as a handful of genuinely strong
 * sources, not an unfiltered dump of every hit the survey turned up.
 */
export function rankBriefingSources(
  sources: { url: string; score?: number }[],
): { url: string; score?: number }[] {
  const bestByUrl = new Map<string, { url: string; score?: number }>();

  for (const source of sources) {
    const existing = bestByUrl.get(source.url);
    if (!existing || (source.score ?? 0) > (existing.score ?? 0)) {
      bestByUrl.set(source.url, source);
    }
  }

  return Array.from(bestByUrl.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
}

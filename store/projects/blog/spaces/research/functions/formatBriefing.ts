/**
 * Turn a survey's raw findings into a briefing title + markdown body: the topic becomes the title,
 * the body is the findings verbatim followed by a `## Sources` list of the source URLs actually
 * fetched. Never adds a source here that wasn't already in `sources`.
 */
export function formatBriefing(
  topic: string,
  findings: string,
  sources: string[],
): { title: string; body: string } {
  const title = topic.trim() || 'Untitled briefing';
  const sourceList = sources.length > 0 ? sources.map((url) => `- ${url}`).join('\n') : '- (no sources fetched)';
  const body = `${findings}\n\n## Sources\n\n${sourceList}`;

  return { title, body };
}

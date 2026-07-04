const MAX_QUOTE_LENGTH = 280;

/**
 * Build a `citations` row shape from an article, the raw item it draws from, and the passage
 * relied on — trimming/clamping the quote so citations stay a skimmable pull-quote rather than a
 * reproduction of an entire excerpt.
 */
export function formatCitation(
  articleId: string,
  rawItemId: string,
  quote: string,
): { articleId: string; rawItemId: string; quote: string } {
  const trimmed = (quote ?? '').trim();
  const clamped =
    trimmed.length > MAX_QUOTE_LENGTH ? trimmed.slice(0, MAX_QUOTE_LENGTH - 1).trimEnd() + '…' : trimmed;

  return { articleId, rawItemId, quote: clamped };
}

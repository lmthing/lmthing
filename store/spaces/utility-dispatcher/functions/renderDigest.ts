/**
 * Render one batch of queue rows as a deterministic markdown digest. Pure, never throws.
 *
 * Values are quoted VERBATIM from the rows — the dispatcher never paraphrases, summarizes or
 * re-words what a sibling space recorded. Long titles are truncated (with an ellipsis) and the
 * body is capped at 20 lines plus an "…and N more" tail, so a burst of a thousand findings still
 * produces a message a chat client will accept.
 *
 * @param sourceLabel The recipe's human label, e.g. "Deadline alerts".
 * @param entries     The rows to render (already watermark-filtered and sorted).
 * @param recipe      `{ titleColumn, detailColumns }` from the queue registry.
 * @returns Markdown, or `''` when there is nothing to send (callers must not send empty digests).
 */
export function renderDigest(
  sourceLabel: unknown,
  entries: Record<string, unknown>[] | null | undefined,
  recipe: { titleColumn?: unknown; detailColumns?: unknown } | null | undefined,
): string {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const MAX_LINES = 20;
  const MAX_TITLE = 120;

  const titleColumn = typeof recipe?.titleColumn === 'string' ? recipe.titleColumn : '';
  const detailColumns = Array.isArray(recipe?.detailColumns)
    ? (recipe!.detailColumns as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];

  const label = String(sourceLabel ?? 'Updates');
  const lines: string[] = [`**${label}** — ${entries.length} new`];

  for (const row of entries.slice(0, MAX_LINES)) {
    const raw = row && typeof row === 'object' ? row[titleColumn] : undefined;
    let title = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (title === '') title = '(no title)';
    if (title.length > MAX_TITLE) title = `${title.slice(0, MAX_TITLE - 1)}…`;

    const details = detailColumns
      .map((c) => {
        const v = row && typeof row === 'object' ? row[c] : undefined;
        return v === null || v === undefined || v === '' ? null : `${c}=${String(v).replace(/\s+/g, ' ').trim()}`;
      })
      .filter((d): d is string => d !== null);

    lines.push(details.length > 0 ? `- ${title} (${details.join(', ')})` : `- ${title}`);
  }

  if (entries.length > MAX_LINES) lines.push(`…and ${entries.length - MAX_LINES} more`);
  return lines.join('\n');
}

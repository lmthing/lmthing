import React from 'react';

/**
 * One learned taste statement — shown on the taste profile page and inline in chat when the
 * ranker cites a note in a `scoreSummary`. The taste model is meant to be inspectable and
 * chat-correctable, so this renders the statement as plain, editable-feeling text, not a score.
 */
export function TasteNoteCard({
  dimension,
  statement,
  weight,
  supportCount,
}: {
  dimension: string;
  statement: string;
  weight: number;
  supportCount: number;
}) {
  const strength = weight >= 0.85 ? 'Dealbreaker-level' : weight >= 0.6 ? 'Strong' : 'Mild';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {dimension}
        </span>
        <span className="text-xs text-muted-foreground">
          {strength} · {supportCount} signal{supportCount === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">{statement}</p>
    </div>
  );
}

export default TasteNoteCard;

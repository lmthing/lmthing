import React from 'react';

/**
 * An A/B "which would you rather view?" prompt — a lightweight way to grow the taste model
 * without waiting for a real save/dismiss. Picking one side yields a 'note' taste_signal for the
 * chosen listing (and, implicitly, a soft negative signal for the one not picked).
 */
export function TasteQuiz({
  left,
  right,
  onPick,
}: {
  left: { listingId: string; title: string; scoreSummary?: string };
  right: { listingId: string; title: string; scoreSummary?: string };
  onPick?: (listingId: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Which would you rather view?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[left, right].map((option) => (
          <button
            key={option.listingId}
            type="button"
            onClick={() => onPick?.(option.listingId)}
            className="rounded border border-border bg-background p-2 text-left hover:bg-muted"
          >
            <p className="text-sm text-foreground">{option.title}</p>
            {option.scoreSummary ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{option.scoreSummary}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TasteQuiz;

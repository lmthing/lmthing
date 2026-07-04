import React from 'react';

export interface AnnotationLike {
  id: string;
  quote: string;
  note?: string;
  kind?: string;
  color?: string;
  verified?: boolean;
}

export function AnnotationItem({
  annotation,
  onRemove,
}: {
  annotation: AnnotationLike;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="rounded-md bg-muted p-3 text-sm italic text-foreground">
        “{annotation.quote}”
      </div>

      {annotation.note ? <p className="text-sm text-muted-foreground">{annotation.note}</p> : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {annotation.kind ?? 'note'}
          </span>
          {annotation.verified ? (
            <span className="text-xs text-primary" title="Verified">✓ Verified</span>
          ) : null}
        </div>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

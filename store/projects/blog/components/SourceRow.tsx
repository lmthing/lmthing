import React from 'react';
import type { Source } from '@app/types';

export function SourceRow({
  source,
  onRemove,
  onIngest,
  ingesting,
  ingestStatus,
}: {
  source: Source;
  onRemove?: () => void;
  onIngest?: () => void;
  ingesting?: boolean;
  ingestStatus?: string;
}) {
  const topics = Array.isArray(source.topics) ? source.topics : [];

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {source.kind}
          </span>
          <span className="truncate font-medium text-foreground">{source.label || source.value}</span>
          {!source.active ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              inactive
            </span>
          ) : null}
        </div>
        {source.label ? (
          <p className="truncate text-xs text-muted-foreground">{source.value}</p>
        ) : null}
        {topics.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {topics.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {ingestStatus ? (
          <span className="text-xs text-muted-foreground">{ingestStatus}</span>
        ) : null}
        {onIngest && source.kind === 'rss' ? (
          <button
            type="button"
            onClick={onIngest}
            disabled={ingesting}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            {ingesting ? 'Fetching…' : 'Fetch now'}
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-muted"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

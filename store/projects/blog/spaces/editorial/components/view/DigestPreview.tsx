import React from 'react';

/**
 * A small catalog display for a digest — shown in chat while the curator is assembling or
 * discussing a digest, before (or after) it's necessarily rendered into a newsletter.
 */
export function DigestPreview({
  title,
  summary,
  itemCount,
  status,
}: {
  title: string;
  summary?: string;
  itemCount?: number;
  status?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
      </div>
      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      {typeof itemCount === 'number' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'article' : 'articles'}
        </p>
      ) : null}
    </div>
  );
}

export default DigestPreview;

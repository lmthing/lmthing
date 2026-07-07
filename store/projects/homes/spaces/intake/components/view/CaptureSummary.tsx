import React from 'react';

/**
 * A parse-result catalog card for one `raw_captures` row — shown in the paste inbox and in chat
 * right after a capture is submitted, so the user can see at a glance what the clipper found.
 */
export function CaptureSummary({
  status,
  summary,
  error,
  listingsFound,
  sourceUrl,
}: {
  status: string;
  summary?: string;
  error?: string;
  listingsFound?: number;
  sourceUrl?: string;
}) {
  const badgeText =
    status === 'parsed' ? 'Parsed' :
    status === 'parsing' ? 'Parsing…' :
    status === 'error' ? 'Failed' :
    'Pending';

  const badgeClass =
    status === 'error' ? 'bg-destructive text-primary-foreground' :
    status === 'parsed' ? 'bg-primary text-primary-foreground' :
    'bg-muted text-muted-foreground';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{badgeText}</span>
        {typeof listingsFound === 'number' ? (
          <span className="text-xs text-muted-foreground">
            {listingsFound} listing{listingsFound === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {summary ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{summary}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {sourceUrl ? <p className="mt-2 truncate text-xs text-muted-foreground">{sourceUrl}</p> : null}
    </div>
  );
}

export default CaptureSummary;

import React from 'react';

/**
 * A summary of what the records analyst extracted from one uploaded document — the domain rows it
 * produced (with confidence) plus the document's own closing summary/error text. Shown in chat
 * right after an `analyze` action completes.
 */
export function ExtractionSummary({
  status,
  summary,
  error,
  extractions,
}: {
  status: 'pending' | 'analyzing' | 'analyzed' | 'error';
  summary?: string;
  error?: string;
  extractions: { table: string; rowId: string; confidence?: number }[];
}) {
  const isError = status === 'error';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">Document analysis</h3>
        <span className={isError ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
          {status}
        </span>
      </div>

      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      {isError && error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}

      {extractions.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {extractions.map((e) => {
            const low = typeof e.confidence === 'number' && e.confidence < 0.5;
            return (
              <li
                key={`${e.table}-${e.rowId}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <span className="text-foreground">{e.table}</span>
                <span className={low ? 'text-xs text-destructive' : 'text-xs text-primary'}>
                  {typeof e.confidence === 'number' ? `${Math.round(e.confidence * 100)}% confidence` : 'unknown confidence'}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default ExtractionSummary;

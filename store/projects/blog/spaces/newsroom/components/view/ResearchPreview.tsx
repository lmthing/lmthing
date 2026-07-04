import React from 'react';

/**
 * A small catalog display for a research deep-dive — shown in chat while the researcher is
 * working on or has just finished a report, before the reader opens the full research panel.
 */
export function ResearchPreview({
  topic,
  status,
  body,
}: {
  topic: string;
  status?: string;
  body?: string;
}) {
  const snippet = body ? body.replace(/\s+/g, ' ').trim().slice(0, 220) : undefined;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{topic}</h3>
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
      </div>
      {snippet ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {snippet}
          {body && body.length > 220 ? '…' : ''}
        </p>
      ) : null}
    </div>
  );
}

export default ResearchPreview;

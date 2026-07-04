import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-primary text-primary-foreground',
  pending: 'border border-border text-muted-foreground',
  error: 'border border-destructive text-destructive',
};

/**
 * A small catalog display for a research briefing — shown in chat while the analyst is assembling
 * or discussing a briefing, before (or after) the reader opens the full report.
 */
export function BriefingPreview({
  briefing,
}: {
  briefing: { title: string; topic?: string; status?: string; sourceCount?: number };
}) {
  const { title, topic, status, sourceCount } = briefing;
  const statusClass = status ? STATUS_STYLES[status] ?? 'border border-border text-muted-foreground' : undefined;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {status ? (
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{status}</span>
        ) : null}
      </div>
      {topic ? <p className="mt-1 text-sm text-muted-foreground">{topic}</p> : null}
      {typeof sourceCount === 'number' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        </p>
      ) : null}
    </div>
  );
}

export default BriefingPreview;

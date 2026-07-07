import React from 'react';

export interface SourceHealthLike {
  id: string;
  itemCount?: number;
  errorCount?: number;
  successRate?: number;
  lastError?: string;
  /** Rolling status recorded by the fetcher: `ok` when healthy, otherwise degraded/error. */
  lastStatus?: string;
  updatedAt?: string;
  source?: { id?: string; label?: string; value?: string };
}

/** Collapse the raw `lastStatus` + error signals into one display tone. */
function resolveHealth(row: SourceHealthLike): {
  label: string;
  pill: string;
  bar: string;
} {
  const rate = row.successRate ?? 1;
  const status = (row.lastStatus ?? 'ok').toLowerCase();
  const hasErrors = (row.errorCount ?? 0) > 0;

  // Hard failure — the source is erroring outright or almost never succeeds.
  if (status === 'error' || status === 'down' || rate < 0.5) {
    return {
      label: 'error',
      pill: 'border border-destructive bg-destructive text-destructive-foreground',
      bar: 'bg-destructive',
    };
  }
  // Degraded — recovering, intermittently failing, or below a healthy rate.
  if (status !== 'ok' || hasErrors || rate < 0.95) {
    return {
      label: status === 'ok' ? 'degraded' : status,
      pill: 'border border-warning bg-warning text-warning-foreground',
      bar: 'bg-warning',
    };
  }
  return {
    label: 'healthy',
    pill: 'border border-success bg-success text-success-foreground',
    bar: 'bg-success',
  };
}

export function SourceHealthBar({ row }: { row: SourceHealthLike }) {
  const { label, pill, bar } = resolveHealth(row);
  const pct = Math.max(0, Math.min(100, Math.round((row.successRate ?? 0) * 100)));

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-foreground">
          {row.source?.label ?? row.source?.value ?? 'Source'}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pill}`}>
          {label}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{(row.itemCount ?? 0).toLocaleString()} items</span>
        <span>{pct}% success</span>
      </div>

      {row.lastError && label !== 'healthy' ? (
        <p className="truncate text-xs text-muted-foreground" title={row.lastError}>
          Last error: {row.lastError}
        </p>
      ) : null}
    </div>
  );
}

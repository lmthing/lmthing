import React from 'react';

export interface SourceHealthLike {
  id: string;
  itemCount?: number;
  successRate?: number;
  status?: 'ok' | 'error' | 'stale';
  source?: { id?: string; label?: string; value?: string };
}

export function SourceHealthBar({ row }: { row: SourceHealthLike }) {
  const statusClass =
    row.status === 'ok'
      ? 'bg-primary text-primary-foreground'
      : row.status === 'error'
        ? 'border border-destructive text-destructive'
        : 'border border-border text-muted-foreground';

  const pct = Math.max(0, Math.min(100, Math.round((row.successRate ?? 0) * 100)));

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {row.source?.label ?? row.source?.value ?? 'Source'}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
          {row.status ?? 'ok'}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{row.itemCount ?? 0} items</span>
        <span>{pct}% success</span>
      </div>
    </div>
  );
}

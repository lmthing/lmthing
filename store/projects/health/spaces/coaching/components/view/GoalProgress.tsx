import React from 'react';

/**
 * A small progress card for one wellness goal — shown in chat when the coach reports on or
 * discusses check-in progress. Framed as an observation, never a verdict.
 */
export function GoalProgress({
  title,
  current,
  target,
  status,
}: {
  title: string;
  current: number;
  target?: number;
  status?: string;
}) {
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const badgeClass = status === 'met' ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {status ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{status}</span>
        ) : null}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {current}
        {target != null ? ` / ${target}` : ''}
      </p>
    </div>
  );
}

export default GoalProgress;

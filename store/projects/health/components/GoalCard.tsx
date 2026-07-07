import React from 'react';
import type { Goal } from '@app/types';
import { fmtDate } from './format';

function statusClasses(status: string) {
  if (status === 'met') return 'bg-success text-success-foreground';
  if (status === 'archived') return 'bg-muted text-muted-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function GoalCard({ goal }: { goal: Goal }) {
  // "Closeness to target" works whether the target is above the current value
  // (e.g. steps, sleep) or below it (e.g. losing weight) — 100% only at target.
  const pct = goal.target
    ? Math.min(
        100,
        (goal.current <= goal.target ? goal.current / goal.target : goal.target / goal.current) * 100,
      )
    : 0;
  const met = goal.status === 'met';

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">{goal.title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(goal.status)}`}>
          {goal.status}
        </span>
      </div>
      {goal.metricKind ? <p className="text-xs uppercase text-muted-foreground">{goal.metricKind}</p> : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${met ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {goal.current}
        {goal.target ? ` / ${goal.target}` : ''}
        {goal.target ? ` · ${Math.round(pct)}%` : ''}
      </p>
      {goal.dueAt ? <p className="text-xs text-muted-foreground">Due {fmtDate(goal.dueAt)}</p> : null}
    </div>
  );
}

export default GoalCard;

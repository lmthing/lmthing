import React from 'react';
import type { Goal } from '@app/types';

function statusClasses(status: string) {
  if (status === 'met') return 'bg-success text-success-foreground';
  if (status === 'archived') return 'bg-muted text-muted-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function GoalCard({ goal }: { goal: Goal }) {
  const pct = goal.target ? Math.min(100, (goal.current / goal.target) * 100) : 0;

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
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        {goal.current}
        {goal.target ? ` / ${goal.target}` : ''}
      </p>
      {goal.dueAt ? <p className="text-xs text-muted-foreground">Due {goal.dueAt}</p> : null}
    </div>
  );
}

export default GoalCard;

import React from 'react';

/**
 * Determinate plan-status bar. While the chef is planning, this shows real progress
 * ("Planned 4 of 7 dinners…") instead of an indefinite spinner, driven by counting filled slots
 * against the 7-dinner target. Honors `prefers-reduced-motion` (no transition under motion-reduce).
 */
export function PlanProgress({
  planned,
  target,
  status,
}: {
  planned: number;
  target: number;
  status: string;
}) {
  const safeTarget = target > 0 ? target : 7;
  const pct = Math.min(100, Math.round((planned / safeTarget) * 100));
  const planning = status === 'planning';

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {planning
            ? `Planning… ${planned} of ${safeTarget} dinners`
            : `Planned ${planned} of ${safeTarget} dinners`}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            planning
              ? 'h-full rounded-full bg-primary/70 transition-all motion-reduce:transition-none'
              : 'h-full rounded-full bg-primary transition-all motion-reduce:transition-none'
          }
          style={{ width: `${Math.max(pct, planning ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export default PlanProgress;

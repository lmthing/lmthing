import React from 'react';
import type { Followup } from '@app/types';

export function FollowupRow({
  followup,
  onComplete,
}: {
  followup: Followup;
  onComplete?: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{followup.topic}</span>
          {followup.done ? (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-bold uppercase text-success-foreground">
              done
            </span>
          ) : (
            <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold uppercase text-warning-foreground">
              due
            </span>
          )}
        </div>
        {followup.reason ? <p className="text-sm text-muted-foreground">{followup.reason}</p> : null}
        <p className="text-sm text-muted-foreground">Due {followup.dueAt}</p>
      </div>
      <button
        type="button"
        disabled={followup.done}
        onClick={() => onComplete?.(followup.id)}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {followup.done ? 'Done' : 'Mark done'}
      </button>
    </div>
  );
}

export default FollowupRow;

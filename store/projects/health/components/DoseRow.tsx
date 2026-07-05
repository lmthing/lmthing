import React from 'react';
import type { AdherenceLog } from '@app/types';

function statusClasses(status: string) {
  if (status === 'taken') return 'bg-success text-success-foreground';
  if (status === 'missed') return 'bg-destructive text-destructive-foreground';
  if (status === 'skipped') return 'bg-muted text-muted-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function DoseRow({ dose, medicationName }: { dose: AdherenceLog; medicationName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{medicationName}</p>
        <p className="text-sm text-muted-foreground">
          Scheduled {dose.scheduledAt}
          {dose.takenAt ? ` · taken ${dose.takenAt}` : ''}
        </p>
        {dose.note ? <p className="text-sm text-foreground">{dose.note}</p> : null}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(dose.status)}`}>
        {dose.status}
      </span>
    </div>
  );
}

export default DoseRow;

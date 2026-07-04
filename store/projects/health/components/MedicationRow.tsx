import React from 'react';
import type { Medication } from '@app/types';

export function MedicationRow({ medication }: { medication: Medication }) {
  const ongoing = !medication.endedAt;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{medication.name}</span>
          {ongoing ? (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-bold uppercase text-success-foreground">
              ongoing
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold uppercase text-muted-foreground">
              ended
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {medication.dose ? `${medication.dose} · ` : ''}
          {medication.schedule ?? ''}
        </p>
        <p className="text-sm text-muted-foreground">
          Started {medication.startedAt}
          {medication.endedAt ? ` · ended ${medication.endedAt}` : ''}
        </p>
        {medication.note ? <p className="text-sm text-foreground">{medication.note}</p> : null}
      </div>
    </div>
  );
}

export default MedicationRow;

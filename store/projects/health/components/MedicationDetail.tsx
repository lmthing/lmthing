import React from 'react';
import type { Medication } from '@app/types';

export function MedicationDetail({ medication }: { medication: Medication }) {
  const ongoing = !medication.endedAt;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{medication.name}</h1>
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
      <p className="text-muted-foreground">
        {medication.dose ? `${medication.dose} · ` : ''}
        {medication.schedule ?? ''}
      </p>
      <p className="text-sm text-muted-foreground">
        Started {medication.startedAt}
        {medication.endedAt ? ` · ended ${medication.endedAt}` : ''}
      </p>
      {medication.refillsRemaining != null ? (
        <p className="text-sm text-muted-foreground">Refills remaining: {medication.refillsRemaining}</p>
      ) : null}
      {medication.reminderTime ? (
        <p className="text-sm text-muted-foreground">Daily reminder: {medication.reminderTime}</p>
      ) : null}
      {medication.note ? <p className="text-sm text-foreground">{medication.note}</p> : null}
    </div>
  );
}

export default MedicationDetail;

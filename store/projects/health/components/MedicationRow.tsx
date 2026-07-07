import React from 'react';
import type { Medication } from '@app/types';
import { Link } from '@app/runtime';
import { fmtDate } from './format';

export function MedicationRow({ medication }: { medication: Medication }) {
  const ongoing = !medication.endedAt;

  return (
    <Link
      href={`/medications/${medication.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
    >
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
          Started {fmtDate(medication.startedAt)}
          {medication.endedAt ? ` · ended ${fmtDate(medication.endedAt)}` : ''}
        </p>
        {medication.note ? <p className="text-sm text-foreground">{medication.note}</p> : null}
      </div>
      <span aria-hidden className="shrink-0 text-muted-foreground">
        →
      </span>
    </Link>
  );
}

export default MedicationRow;

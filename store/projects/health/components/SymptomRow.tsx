import React from 'react';
import type { Symptom } from '@app/types';

export function SymptomRow({ symptom }: { symptom: Symptom }) {
  const ongoing = !symptom.endedAt;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{symptom.name}</span>
          {ongoing ? (
            <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold uppercase text-warning-foreground">
              ongoing
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          started {symptom.startedAt}
          {symptom.endedAt ? ` · ended ${symptom.endedAt}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1" title={`Severity ${symptom.severity}/5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < (symptom.severity ?? 1)
                ? 'h-2 w-2 rounded-full bg-primary'
                : 'h-2 w-2 rounded-full border border-border'
            }
          />
        ))}
      </div>
    </div>
  );
}

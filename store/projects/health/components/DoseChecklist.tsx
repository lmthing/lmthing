import React from 'react';
import type { Medication } from '@app/types';

export function DoseChecklist({
  medications,
  onMark,
  markingId,
}: {
  medications: Medication[];
  onMark: (medicationId: string) => void;
  markingId?: string | null;
}) {
  return (
    <div className="space-y-2">
      {medications.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{m.name}</p>
            <p className="text-sm text-muted-foreground">
              {m.dose ? `${m.dose} · ` : ''}
              {m.schedule ?? ''}
            </p>
          </div>
          <button
            type="button"
            disabled={markingId === m.id}
            onClick={() => onMark(m.id)}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {markingId === m.id ? 'Marking…' : 'Mark taken'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default DoseChecklist;

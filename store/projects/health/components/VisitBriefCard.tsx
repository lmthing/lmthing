import React from 'react';
import type { VisitBrief } from '@app/types';

function statusClasses(status: string) {
  if (status === 'ready') return 'bg-success text-success-foreground';
  if (status === 'error') return 'bg-destructive text-destructive-foreground';
  return 'bg-warning text-warning-foreground';
}

export function VisitBriefCard({ brief }: { brief: VisitBrief }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">{brief.title}</h3>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(brief.status)}`}
          >
            {brief.status}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
          >
            Print
          </button>
        </div>
      </div>
      {brief.periodFrom || brief.periodTo ? (
        <p className="text-sm text-muted-foreground">
          {brief.periodFrom ?? '—'} – {brief.periodTo ?? '—'}
        </p>
      ) : null}
      <div className="whitespace-pre-wrap text-sm text-foreground">{brief.body}</div>
    </div>
  );
}

export default VisitBriefCard;

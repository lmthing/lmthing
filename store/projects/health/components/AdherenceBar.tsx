import React from 'react';

export function AdherenceBar({ doses }: { doses: { status: string }[] }) {
  const total = doses.length;
  const taken = doses.filter((d) => d.status === 'taken').length;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

  const barClasses = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
  const textClasses = pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive';

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No doses logged yet.</p>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Adherence</span>
        <span className={`font-bold ${textClasses}`}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClasses}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {taken} of {total} dose{total === 1 ? '' : 's'} taken
      </p>
    </div>
  );
}

export default AdherenceBar;

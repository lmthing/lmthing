import React from 'react';

/**
 * A small adherence card for one medication — shown in chat when the pharmacist reports on or
 * discusses today's adherence. Framed as an observation, never a verdict.
 */
export function AdherenceCard({
  title,
  rate,
  nextDueAt,
}: {
  title: string;
  rate: number;
  nextDueAt?: string | null;
}) {
  const pct = Math.min(100, Math.max(0, rate * 100));
  const barClass = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
  const textClass = pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className={`text-sm font-medium ${textClass}`}>{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      {nextDueAt ? (
        <p className="mt-1 text-xs text-muted-foreground">Next dose due {nextDueAt}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No dose currently due</p>
      )}
    </div>
  );
}

export default AdherenceCard;

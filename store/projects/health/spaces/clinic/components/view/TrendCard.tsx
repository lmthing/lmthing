import React from 'react';

/**
 * A small trend display for one metric — the label, a badge for whether the move looks roughly
 * flat (|change| < 5%) or notable, and the plain-language "+X% over the period" line. Shown in
 * chat by the interpreter's digest and appointment-prep actions.
 */
export function TrendCard({
  label,
  changePct,
  unit,
}: {
  label: string;
  changePct: number;
  unit?: string;
}) {
  const flat = Math.abs(changePct) < 5;
  const sign = changePct > 0 ? '+' : '';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span
          className={
            flat
              ? 'rounded-full bg-success px-2 py-0.5 text-xs font-bold uppercase text-success-foreground'
              : 'rounded-full bg-warning px-2 py-0.5 text-xs font-bold uppercase text-warning-foreground'
          }
        >
          {flat ? 'steady' : 'notable'}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {sign}
        {changePct}% over the period
        {unit ? ` (${unit})` : ''}
      </p>
    </div>
  );
}

export default TrendCard;

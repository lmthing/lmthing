import React from 'react';

/**
 * A compact card summarizing one care-summary export — shown in chat when the coordinator reports
 * on a compiled (or still-pending) `care_shares` row. This is an export of the user's own records,
 * never a clinical verdict.
 */
export function CareSummaryCard({
  title,
  scope,
  status,
}: {
  title: string;
  scope: string;
  status: string;
}) {
  const badgeClass = status === 'ready' ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{status}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">scope: {scope}</p>
    </div>
  );
}

export default CareSummaryCard;

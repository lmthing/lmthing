import React from 'react';

/**
 * A card for one savings opportunity the deal-hunter found — shown in chat when surfacing a deal.
 * Advisory only; a deal never implies a booking has been made on the traveller's behalf.
 */
export function DealCard({
  kind,
  title,
  description,
  estimatedSavings,
  currency,
  status = 'active',
}: {
  kind: string;
  title: string;
  description?: string;
  estimatedSavings?: number;
  currency?: string;
  status?: string;
}) {
  const isActive = status === 'active';
  const savings =
    estimatedSavings != null ? `${currency ?? 'USD'} ${estimatedSavings.toFixed(2)}` : null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span
          className={
            isActive ? 'text-xs font-medium text-primary' : 'text-xs font-medium text-muted-foreground'
          }
        >
          {status}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        <span className="capitalize">{kind}</span>
        {savings ? <span className="font-medium text-foreground">save {savings}</span> : null}
      </div>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export default DealCard;

import React from 'react';

/**
 * A small card for one planned transit leg — shown in chat while the navigator is proposing or
 * discussing legs, before (or after) they're written to `transit_legs`.
 */
export function TransitLegCard({
  mode,
  durationMinutes,
  estimatedCost,
  currency,
  bookByDate,
  status = 'suggested',
}: {
  mode: string;
  durationMinutes?: number;
  estimatedCost?: number;
  currency?: string;
  bookByDate?: string;
  status?: string;
}) {
  const isSuggested = status === 'suggested';

  const duration =
    durationMinutes != null
      ? durationMinutes >= 60
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : `${durationMinutes}m`
      : null;

  const cost = estimatedCost != null ? `${currency ?? 'USD'} ${estimatedCost.toFixed(2)}` : null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold capitalize text-foreground">{mode}</h3>
        <span
          className={isSuggested ? 'text-xs font-medium text-primary' : 'text-xs font-medium text-destructive'}
        >
          {status}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
        {duration ? <span>{duration}</span> : null}
        {cost ? <span>{cost}</span> : null}
      </div>
      {bookByDate ? (
        <p className="mt-1 text-xs text-muted-foreground">Book by {bookByDate}</p>
      ) : null}
    </div>
  );
}

export default TransitLegCard;

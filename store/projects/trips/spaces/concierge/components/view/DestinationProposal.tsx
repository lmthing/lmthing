import React from 'react';

/**
 * A small catalog display for a proposed destination — shown in chat while the scheduler/planner
 * is proposing or discussing a stop, before it's necessarily committed to the database.
 */
export function DestinationProposal({
  name,
  arrivalDate,
  departureDate,
  notes,
}: {
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
}) {
  const dates = [arrivalDate, departureDate].filter(Boolean).join(' – ');

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        {dates ? <span className="text-xs text-muted-foreground">{dates}</span> : null}
      </div>
      {notes ? <p className="mt-1 text-sm text-muted-foreground">{notes}</p> : null}
    </div>
  );
}

export default DestinationProposal;

import React from 'react';
import type { Destination } from '@app/types';
import { Link } from '@app/runtime';
import { formatDateRange } from './format';

export function DestinationHeader({
  destination,
  tripId,
}: {
  destination: Destination;
  tripId: string;
}) {
  const dates = formatDateRange(destination.arrivalDate, destination.departureDate);

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">{destination.name}</h2>
        {dates ? <p className="text-sm text-muted-foreground">{dates}</p> : null}
        {destination.notes ? (
          <p className="text-sm text-muted-foreground">{destination.notes}</p>
        ) : null}
      </div>
      <Link
        href={`/trips/${tripId}/research/${destination.id}`}
        className="shrink-0 text-sm text-primary hover:underline"
      >
        Research →
      </Link>
    </div>
  );
}

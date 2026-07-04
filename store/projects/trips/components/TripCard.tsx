import React from 'react';
import type { Trip } from '@app/types';
import { Link } from '@app/runtime';

function statusPillClass(status: string): string {
  if (status === 'booked') {
    return 'rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground';
  }
  if (status === 'complete') {
    return 'rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground';
  }
  return 'rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground';
}

export function TripCard({ trip }: { trip: Trip }) {
  const dates = [trip.startDate, trip.endDate].filter(Boolean).join(' – ');

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block rounded-lg border border-border bg-card p-4 space-y-2 hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{trip.title}</span>
        <span className={statusPillClass(trip.status)}>{trip.status}</span>
      </div>
      {dates ? <p className="text-sm text-muted-foreground">{dates}</p> : null}
      {trip.brief ? (
        <p className="text-sm text-muted-foreground line-clamp-2">{trip.brief}</p>
      ) : null}
    </Link>
  );
}

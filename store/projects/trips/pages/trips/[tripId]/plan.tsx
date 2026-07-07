import React from 'react';
import type { Trip, Destination, ItineraryItem, Booking } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { Spinner } from '../../../components/Spinner';
import { TripTabs } from '../../../components/TripTabs';
import { RunStrip } from '../../../components/RunStrip';

type FullTrip = Trip & {
  destinations: (Destination & { items: ItineraryItem[] })[];
  bookings: Booking[];
};

export default function PlanTrip({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data: trip, isLoading, error } = useApi<FullTrip>('getTrip', { id: tripId });

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="col-span-full">
        <TripTabs tripId={tripId} active="plan" />
      </div>

      <div className="space-y-4">
        <div>
          <Link href={`/trips/${tripId}`} className="text-sm text-muted-foreground hover:text-primary">
            ← Back to timeline
          </Link>
          <h1 className="mt-2 text-xl font-bold text-foreground">
            {trip ? trip.title : 'Plan your trip'}
          </h1>
        </div>

        <RunStrip tripId={tripId} />

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load trip.
          </div>
        ) : null}

        {trip ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            {trip.brief ? <p className="text-sm text-muted-foreground">{trip.brief}</p> : null}

            {(trip.destinations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No destinations planned yet.</p>
            ) : (
              <div className="space-y-3">
                {trip.destinations.map((dest) => (
                  <div key={dest.id} className="space-y-1">
                    <p className="font-medium text-foreground">{dest.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(dest.items ?? []).length} item{(dest.items ?? []).length === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">
          Refine with the concierge
        </h2>
        <Chat agent="concierge/planner" />
      </div>
    </main>
  );
}

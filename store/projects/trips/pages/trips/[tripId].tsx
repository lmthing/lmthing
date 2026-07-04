import React, { useEffect, useState } from 'react';
import type { Trip, Destination, ItineraryItem, Booking } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { DestinationHeader } from '../../components/DestinationHeader';
import { DayColumn } from '../../components/DayColumn';
import { BookingRow } from '../../components/BookingRow';
import { BudgetStrip } from '../../components/BudgetStrip';
import { Spinner } from '../../components/Spinner';
import { TripTabs } from '../../components/TripTabs';

type FullTrip = Trip & {
  destinations: (Destination & { items: ItineraryItem[] })[];
  bookings: Booking[];
};

function groupByDay(items: ItineraryItem[]): { day: string; items: ItineraryItem[] }[] {
  const map = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const day = item.day ?? '';
    const bucket = map.get(day);
    if (bucket) bucket.push(item);
    else map.set(day, [item]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, dayItems]) => ({ day, items: dayItems }));
}

export default function TripTimeline({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [polling, setPolling] = useState(false);

  const {
    data: trip,
    isLoading,
    error,
  } = useApi<FullTrip>(
    'getTrip',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  useEffect(() => {
    setPolling(trip?.status === 'planning');
  }, [trip?.status]);

  const current = trip;

  if (isLoading && !current) return <Spinner />;

  if (error || !current) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load trip.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="timeline" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{current.title}</h1>
          {current.brief ? (
            <p className="text-sm text-muted-foreground">{current.brief}</p>
          ) : null}
        </div>
        <Link href={`/trips/${tripId}/plan`} className="shrink-0 text-sm text-primary hover:underline">
          Refine in chat
        </Link>
      </div>

      <BudgetStrip tripId={tripId} />

      {current.status === 'planning' ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The concierge is planning your trip…
        </div>
      ) : null}

      {(current.destinations ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No destinations yet.
        </div>
      ) : null}

      <div className="space-y-8">
        {(current.destinations ?? []).map((dest) => (
          <div key={dest.id} className="space-y-4">
            <DestinationHeader destination={dest} tripId={tripId} />
            <div className="space-y-4">
              {groupByDay(dest.items ?? []).map((group) => (
                <DayColumn key={group.day} date={group.day} items={group.items} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {(current.bookings ?? []).length > 0 ? (
        <div className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Bookings</h2>
          <div className="space-y-2">
            {current.bookings.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}

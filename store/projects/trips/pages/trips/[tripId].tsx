import React, { useEffect, useState } from 'react';
import type { Trip, Destination, ItineraryItem, Booking } from '@app/types';
import { useApi, useApiMutation, navigate, Link } from '@app/runtime';
import { DestinationHeader } from '../../components/DestinationHeader';
import { DayColumn } from '../../components/DayColumn';
import { BookingRow } from '../../components/BookingRow';
import { BudgetStrip } from '../../components/BudgetStrip';
import { Spinner } from '../../components/Spinner';
import { TripTabs } from '../../components/TripTabs';
import { PlusIcon, TrashIcon } from '../../components/icons';

type FullTrip = Trip & {
  homeCurrency?: string;
  destinations: (Destination & { items: ItineraryItem[] })[];
  bookings: Booking[];
};

const STATUSES = ['planning', 'booked', 'complete'];
const BOOKING_KINDS = ['flight', 'hotel', 'car', 'activity'];

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
  const [showAddDest, setShowAddDest] = useState(false);
  const [showAddBooking, setShowAddBooking] = useState(false);

  const [destName, setDestName] = useState('');
  const [destArrival, setDestArrival] = useState('');
  const [destDeparture, setDestDeparture] = useState('');

  const [bkKind, setBkKind] = useState('flight');
  const [bkProvider, setBkProvider] = useState('');
  const [bkConfirmation, setBkConfirmation] = useState('');
  const [bkCost, setBkCost] = useState('');

  const {
    data: trip,
    isLoading,
    error,
  } = useApi<FullTrip>(
    'getTrip',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const updateTrip = useApiMutation<Trip>('updateTrip', {
    invalidates: ['getTrip', 'tripList'],
  });
  const deleteTrip = useApiMutation<{ ok: boolean }>('deleteTrip', {
    invalidates: ['tripList'],
  });
  const addDestination = useApiMutation<Destination>('addDestination', {
    invalidates: ['getTrip'],
  });
  const addBooking = useApiMutation<Booking>('addBooking', {
    invalidates: ['getTrip', 'tripBudget', 'tripFinances'],
  });

  useEffect(() => {
    setPolling(trip?.status === 'planning');
  }, [trip?.status]);

  const current = trip;
  const currency = current?.homeCurrency ?? 'USD';

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

  const onAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName.trim()) return;
    try {
      await addDestination.mutate({
        id: tripId,
        name: destName.trim(),
        arrivalDate: destArrival || undefined,
        departureDate: destDeparture || undefined,
        orderIndex: current.destinations?.length ?? 0,
      });
      setDestName('');
      setDestArrival('');
      setDestDeparture('');
      setShowAddDest(false);
    } catch {
      // surfaced via addDestination.error below
    }
  };

  const onAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bkProvider.trim()) return;
    try {
      await addBooking.mutate({
        tripId,
        kind: bkKind,
        provider: bkProvider.trim(),
        confirmation: bkConfirmation.trim() || undefined,
        cost: bkCost ? Number(bkCost) : undefined,
      });
      setBkProvider('');
      setBkConfirmation('');
      setBkCost('');
      setBkKind('flight');
      setShowAddBooking(false);
    } catch {
      // surfaced via addBooking.error below
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this trip and everything in it? This cannot be undone.')) return;
    try {
      await deleteTrip.mutate({ id: tripId });
      navigate('/');
    } catch {
      // surfaced via deleteTrip.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="timeline" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{current.title}</h1>
          {current.brief ? (
            <p className="text-sm text-muted-foreground">{current.brief}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={current.status}
            onChange={(e) => updateTrip.mutate({ id: tripId, status: e.target.value })}
            disabled={updateTrip.isPending}
            title="Trip status"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Link
            href={`/trips/${tripId}/plan`}
            className="rounded-md px-2 py-1.5 text-sm text-primary hover:underline"
          >
            Refine in chat
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteTrip.isPending}
            title="Delete trip"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BudgetStrip tripId={tripId} currency={currency} />

      {current.status === 'planning' ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The concierge is planning your trip…
        </div>
      ) : null}

      {/* Destinations */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Itinerary
        </h2>
        <button
          type="button"
          onClick={() => setShowAddDest((v) => !v)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <PlusIcon className="h-4 w-4" />
          Add destination
        </button>
      </div>

      {showAddDest ? (
        <form
          onSubmit={onAddDestination}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="dest-name">
              Destination
            </label>
            <input
              id="dest-name"
              value={destName}
              onChange={(e) => setDestName(e.target.value)}
              placeholder="Lisbon"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="dest-arrival">
              Arrival
            </label>
            <input
              id="dest-arrival"
              type="date"
              value={destArrival}
              onChange={(e) => setDestArrival(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="dest-departure">
              Departure
            </label>
            <input
              id="dest-departure"
              type="date"
              value={destDeparture}
              onChange={(e) => setDestDeparture(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addDestination.isPending || !destName.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : null}

      {(current.destinations ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No destinations yet. Add one above or refine with the concierge.
        </div>
      ) : null}

      <div className="space-y-8">
        {(current.destinations ?? []).map((dest) => (
          <div key={dest.id} className="space-y-4">
            <DestinationHeader destination={dest} tripId={tripId} />
            {(dest.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No items scheduled here yet.</p>
            ) : null}
            <div className="space-y-4">
              {groupByDay(dest.items ?? []).map((group) => (
                <DayColumn key={group.day} date={group.day} items={group.items} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bookings */}
      <div className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Bookings</h2>
          <button
            type="button"
            onClick={() => setShowAddBooking((v) => !v)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <PlusIcon className="h-4 w-4" />
            Add booking
          </button>
        </div>

        {showAddBooking ? (
          <form
            onSubmit={onAddBooking}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="bk-kind">
                Kind
              </label>
              <select
                id="bk-kind"
                value={bkKind}
                onChange={(e) => setBkKind(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {BOOKING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="bk-provider">
                Provider
              </label>
              <input
                id="bk-provider"
                value={bkProvider}
                onChange={(e) => setBkProvider(e.target.value)}
                placeholder="TAP Air Portugal"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="bk-confirmation">
                Confirmation
              </label>
              <input
                id="bk-confirmation"
                value={bkConfirmation}
                onChange={(e) => setBkConfirmation(e.target.value)}
                placeholder="ABC123"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="bk-cost">
                Cost
              </label>
              <input
                id="bk-cost"
                type="number"
                min="0"
                step="0.01"
                value={bkCost}
                onChange={(e) => setBkCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={addBooking.isPending || !bkProvider.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
          </form>
        ) : null}

        {(current.bookings ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No bookings yet.
          </div>
        ) : (
          <div className="space-y-2">
            {current.bookings.map((b) => (
              <BookingRow key={b.id} booking={b} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

import React, { useEffect, useState } from 'react';
import type { Trip, Destination, ItineraryItem, Booking } from '@app/types';
import { useApi, useApiMutation, apiCall } from '@app/runtime';
import { DestinationHeader } from '../../../components/DestinationHeader';
import { DayTimeline } from '../../../components/DayTimeline';
import { BookingRow } from '../../../components/BookingRow';
import { BudgetStrip } from '../../../components/BudgetStrip';
import { RunStrip } from '../../../components/RunStrip';
import { CopilotDock } from '../../../components/CopilotDock';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { TripTabs } from '../../../components/TripTabs';
import { PlusIcon, CloudIcon, DownloadIcon, MapPinIcon } from '../../../components/icons';

type FullTrip = Trip & {
  homeCurrency?: string;
  destinations: (Destination & { items: ItineraryItem[] })[];
  bookings: Booking[];
};

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

  const { data: trip, isLoading, error, refetch } = useApi<FullTrip>('getTrip', { id: tripId });

  const addDestination = useApiMutation<Destination>('addDestination', { invalidates: ['getTrip'] });
  const addBooking = useApiMutation<Booking>('addBooking', {
    invalidates: ['getTrip', 'tripBudget', 'tripFinances'],
  });
  const refreshWeather = useApiMutation<{ itemsUpdated: number; note?: string }>('refreshWeather', {
    invalidates: ['getTrip'],
  });

  // Poll while the concierge is still planning so the timeline fills in live.
  useEffect(() => {
    setPolling(trip?.status === 'planning');
  }, [trip?.status]);
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => refetch(), 4000);
    return () => clearInterval(t);
  }, [polling, refetch]);

  const current = trip;
  const currency = current?.homeCurrency ?? 'USD';

  const onAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName.trim() || !current) return;
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
      /* surfaced via addDestination.error */
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
      /* surfaced via addBooking.error */
    }
  };

  const onExportCalendar = async () => {
    try {
      const res = (await apiCall('tripCalendar', { id: tripId })) as { ics: string; filename: string };
      const blob = new Blob([res.ics], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || 'trip.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore export errors */
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="timeline" />

      {isLoading && !current ? (
        <SkeletonList count={3} lines={4} />
      ) : error || !current ? (
        <ErrorState message="Failed to load trip." onRetry={refetch} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{current.title}</h1>
              {current.brief ? <p className="text-sm text-muted-foreground">{current.brief}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => refreshWeather.mutate({ id: tripId })}
                disabled={refreshWeather.isPending}
                title="Refresh weather for scheduled days"
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                <CloudIcon className="h-4 w-4" />
                {refreshWeather.isPending ? 'Checking…' : 'Weather'}
              </button>
              <button
                type="button"
                onClick={onExportCalendar}
                title="Download an .ics calendar of this trip"
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                <DownloadIcon className="h-4 w-4" />
                .ics
              </button>
            </div>
          </div>

          <BudgetStrip tripId={tripId} currency={currency} />

          <RunStrip tripId={tripId} />

          {current.status === 'planning' ? (
            <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
              The concierge is planning your trip…
            </div>
          ) : null}

          {refreshWeather.data?.note ? (
            <p className="text-xs text-muted-foreground">{refreshWeather.data.note}</p>
          ) : null}

          {/* Destinations */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Itinerary</h2>
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
            <EmptyState
              icon={MapPinIcon}
              title="No destinations yet"
              hint="Add a stop above, or let the concierge propose an itinerary from your brief."
              actionLabel="Refine in chat"
              actionHref={`/trips/${tripId}/plan`}
            />
          ) : null}

          <div className="space-y-8">
            {(current.destinations ?? []).map((dest) => (
              <div key={dest.id} className="space-y-4">
                <DestinationHeader destination={dest} tripId={tripId} />
                {(dest.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items scheduled here yet.</p>
                ) : (
                  <div className="space-y-6">
                    {groupByDay(dest.items ?? []).map((group) => (
                      <DayTimeline key={group.day} date={group.day} items={group.items} />
                    ))}
                  </div>
                )}
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
              <EmptyState
                title="No bookings yet"
                hint="Add a flight, hotel or activity booking — or let the copilot ingest a confirmation email."
              />
            ) : (
              <div className="space-y-2">
                {current.bookings.map((b) => (
                  <BookingRow key={b.id} booking={b} currency={currency} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <CopilotDock tripId={tripId} tripTitle={current?.title} />
    </main>
  );
}

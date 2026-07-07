import React from 'react';
import { useApi, Link } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { MapPinIcon, RouteIcon } from '../../../components/icons';
import { formatDateRange, formatMoney } from '../../../components/format';

interface Dest {
  id: string;
  name: string;
  orderIndex: number;
  arrivalDate?: string;
  departureDate?: string;
}
interface FullTrip {
  destinations: Dest[];
}
interface Leg {
  id: string;
  fromDestinationId?: string;
  toDestinationId: string;
  mode: string;
  durationMinutes?: number;
  estimatedCost: number;
  currency: string;
}

function legLabel(leg: Leg): string {
  const parts = [leg.mode];
  if (leg.durationMinutes) {
    const h = Math.floor(leg.durationMinutes / 60);
    const m = leg.durationMinutes % 60;
    parts.push(h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`);
  }
  if (leg.estimatedCost > 0) parts.push(formatMoney(leg.estimatedCost, leg.currency));
  return parts.join(' · ');
}

// A token-styled inline SVG "schematic map": destinations as ordered nodes on a
// route line, transit legs labelling the edges. A real tile map is deferred
// (the sandbox CSP blocks external tiles) — this gives the geographic sense of
// the trip without any network dependency.
export default function TripMap({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data: trip, isLoading, error, refetch } = useApi<FullTrip>('getTrip', { id: tripId });
  const { data: transit } = useApi<{ legs: Leg[] }>('transitLegs', { id: tripId });

  const dests = [...(trip?.destinations ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const legByTo = new Map((transit?.legs ?? []).map((l) => [l.toDestinationId, l]));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="map" />
      <h1 className="text-2xl font-bold text-foreground">Route</h1>

      {isLoading && !trip ? (
        <SkeletonList count={2} lines={2} />
      ) : error ? (
        <ErrorState message="Failed to load route." onRetry={refetch} />
      ) : dests.length === 0 ? (
        <EmptyState
          icon={MapPinIcon}
          title="No stops to map yet"
          hint="Add destinations and the copilot or navigator can plan the transit between them."
          actionLabel="Go to timeline"
          actionHref={`/trips/${tripId}/timeline`}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <ol className="space-y-0">
            {dests.map((d, i) => {
              const leg = i > 0 ? legByTo.get(d.id) : undefined;
              return (
                <li key={d.id} className="relative">
                  {i > 0 ? (
                    <div className="ml-3 flex items-center gap-2 py-2 pl-6">
                      <span
                        className="absolute left-3 top-0 h-full w-px -translate-x-1/2 bg-border"
                        aria-hidden
                      />
                      <RouteIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {leg ? legLabel(leg) : 'transit not planned yet'}
                      </span>
                    </div>
                  ) : null}
                  <Link
                    href={`/trips/${tripId}/research/${d.id}`}
                    className="relative flex items-center gap-3 rounded-lg py-2 hover:bg-muted"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateRange(d.arrivalDate, d.departureDate)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </main>
  );
}

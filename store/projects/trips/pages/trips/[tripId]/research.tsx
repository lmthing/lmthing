import React from 'react';
import { useApi, Link } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { CompassIcon, ChevronRightIcon } from '../../../components/icons';
import { formatDateRange } from '../../../components/format';

interface Dest {
  id: string;
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  items?: unknown[];
}
interface FullTrip {
  destinations: Dest[];
}

// Research index — one entry per destination, linking into the grounded
// per-destination research + "ask the researcher" chat.
export default function ResearchIndex({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data: trip, isLoading, error, refetch } = useApi<FullTrip>('getTrip', { id: tripId });
  const destinations = trip?.destinations ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="research" />
      <h1 className="text-2xl font-bold text-foreground">Research</h1>

      {isLoading && !trip ? (
        <SkeletonList count={3} lines={2} />
      ) : error ? (
        <ErrorState message="Failed to load destinations." onRetry={refetch} />
      ) : destinations.length === 0 ? (
        <EmptyState
          icon={CompassIcon}
          title="No destinations to research yet"
          hint="Add destinations on the timeline, then dive into each with the researcher."
          actionLabel="Go to timeline"
          actionHref={`/trips/${tripId}/timeline`}
        />
      ) : (
        <div className="space-y-2">
          {destinations.map((d) => (
            <Link
              key={d.id}
              href={`/trips/${tripId}/research/${d.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{d.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(d.arrivalDate, d.departureDate) || 'Deep-dive research & Q&A'}
                </p>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

import React from 'react';
import type { Trip } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { TripCard } from '../components/TripCard';
import { Spinner } from '../components/Spinner';

export default function TripList() {
  const { data: trips, isLoading, error } = useApi<Trip[]>('tripList', {});

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Trips</h1>
        <Link
          href="/new"
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Plan a new trip
        </Link>
      </div>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load trips.
        </div>
      ) : null}

      {!isLoading && !error && (trips ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No trips yet.{' '}
          <Link href="/new" className="text-primary hover:underline">
            Plan your first trip
          </Link>
          .
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(trips ?? []).map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    </main>
  );
}

import React from 'react';
import type { Traveler, TravelerPreference, ExpenseShare } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { PreferenceRow } from '../../components/PreferenceRow';
import { Spinner } from '../../components/Spinner';

type TravelerDetail = Traveler & { preferences: TravelerPreference[]; shares: ExpenseShare[] };

function groupByCategory(preferences: TravelerPreference[]): { category: string; preferences: TravelerPreference[] }[] {
  const map = new Map<string, TravelerPreference[]>();
  for (const preference of preferences) {
    const category = preference.category || 'other';
    const bucket = map.get(category);
    if (bucket) bucket.push(preference);
    else map.set(category, [preference]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, catPreferences]) => ({ category, preferences: catPreferences }));
}

export default function TravelerDetail({ params }: { params: { travelerId: string } }) {
  const { travelerId } = params;

  const { data, isLoading, error } = useApi<TravelerDetail>('getTraveler', { id: travelerId });

  const removePreference = useApiMutation<{ ok: boolean }>('removePreference', {
    invalidates: ['getTraveler'],
  });

  const preferences = data?.preferences ?? [];
  const shares = data?.shares ?? [];
  const tripId = data?.tripId;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href={tripId ? `/trips/${tripId}/travelers` : '/'}
        className="text-sm text-muted-foreground hover:text-primary"
      >
        &larr; Back to travelers
      </Link>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load traveler.
        </div>
      ) : null}

      {data ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {data.role}
            </span>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            {data.homeCountry ? <p>{data.homeCountry}</p> : null}
            {data.email ? <p>{data.email}</p> : null}
            {data.notes ? <p>{data.notes}</p> : null}
          </div>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Preferences</h2>

            {preferences.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                No preferences recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {groupByCategory(preferences).map((group) => (
                  <div key={group.category} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">{group.category}</h3>
                    <div className="space-y-2">
                      {group.preferences.map((preference) => (
                        <PreferenceRow
                          key={preference.id}
                          preference={preference}
                          onRemove={(id) => removePreference.mutate({ id })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Expense shares</h2>

            {shares.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                No expense shares yet.
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
                  >
                    <span className={share.settled ? 'text-muted-foreground' : 'text-foreground'}>
                      {share.settled ? 'settled' : 'outstanding'}
                    </span>
                    <span className="font-medium text-foreground">
                      {share.shareAmount.toFixed(2)} {share.currency}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

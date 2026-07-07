import React from 'react';
import type { Traveler, TravelerPreference, ExpenseShare } from '@app/types';
import { useApi, useApiMutation, navigate, Link } from '@app/runtime';
import { PreferenceRow } from '../../components/PreferenceRow';
import { Spinner } from '../../components/Spinner';
import { formatMoney } from '../../components/format';
import { CheckIcon, TrashIcon } from '../../components/icons';

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
  const settleShare = useApiMutation<{ ok: boolean }>('settleShare', {
    invalidates: ['getTraveler', 'settlement'],
  });
  const removeTraveler = useApiMutation<{ ok: boolean }>('removeTraveler', {
    invalidates: ['listTravelers', 'settlement', 'tripFinances'],
  });

  const preferences = data?.preferences ?? [];
  const shares = data?.shares ?? [];
  const tripId = data?.tripId;

  const onRemoveTraveler = async () => {
    if (!confirm('Remove this traveler from the trip?')) return;
    try {
      await removeTraveler.mutate({ id: travelerId });
      navigate(tripId ? `/trips/${tripId}/travelers` : '/');
    } catch {
      // surfaced inline below
    }
  };

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
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {data.role}
              </span>
              <button
                type="button"
                onClick={onRemoveTraveler}
                disabled={removeTraveler.isPending}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
                Remove
              </button>
            </div>
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
                    <span
                      className={
                        share.settled
                          ? 'flex items-center gap-1.5 text-sm text-muted-foreground'
                          : 'text-sm text-foreground'
                      }
                    >
                      {share.settled ? <CheckIcon className="h-4 w-4 text-primary" /> : null}
                      {share.settled ? 'settled' : 'outstanding'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">
                        {formatMoney(share.shareAmount, share.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          settleShare.mutate({ id: share.id, settled: !share.settled })
                        }
                        disabled={settleShare.isPending}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {share.settled ? 'Mark outstanding' : 'Mark settled'}
                      </button>
                    </div>
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

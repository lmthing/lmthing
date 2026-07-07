import React, { useEffect, useState } from 'react';
import type { Search, Listing, Alert } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { SearchTabs } from '../../components/SearchTabs';
import { ListingCard } from '../../components/ListingCard';
import { AlertStrip } from '../../components/AlertStrip';
import { Spinner } from '../../components/Spinner';

interface CommuteTargetLite {
  label: string;
  maxMinutes: number;
}

type SearchWithTargets = Search & {
  commuteTargets: { label: string; address: string; mode: string; maxMinutes: number }[];
};

export default function SearchFeed({ params }: { params: { searchId: string } }) {
  const { searchId } = params;
  const [polling, setPolling] = useState(true);

  const {
    data: search,
    isLoading: searchLoading,
    error: searchError,
  } = useApi<SearchWithTargets>('getSearch', { id: searchId });

  const {
    data: listings,
    isLoading,
    error,
  } = useApi<Listing[]>(
    'listingFeed',
    { id: searchId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const { data: alerts, refetch: refetchAlerts } = useApi<Alert[]>('listAlerts', {
    id: searchId,
    unreadOnly: true,
  });

  useEffect(() => {
    setPolling((listings ?? []).some((l) => (l.score ?? 0) === 0));
  }, [listings]);

  const saveListing = useApiMutation<{ ok: boolean }>('saveListing', {
    invalidates: ['listingFeed'],
  });
  const dismissListing = useApiMutation<{ ok: boolean }>('dismissListing', {
    invalidates: ['listingFeed'],
  });

  const onRead = async (id: string) => {
    try {
      await apiCall('markAlertRead', { id });
      refetchAlerts();
    } catch {
      // best-effort — alert stays visible on failure
    }
  };

  const targets: CommuteTargetLite[] = Array.isArray(search?.commuteTargets)
    ? search!.commuteTargets.map((t) => ({ label: t.label, maxMinutes: t.maxMinutes }))
    : [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <SearchTabs searchId={searchId} active="feed" />

      {searchLoading ? <Spinner label="Loading search…" /> : null}
      {searchError ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load search.
        </div>
      ) : null}

      {search ? (
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{search.title}</h1>
          {search.brief ? <p className="text-sm text-muted-foreground">{search.brief}</p> : null}
        </div>
      ) : null}

      {(alerts ?? []).length > 0 ? <AlertStrip alerts={alerts ?? []} onRead={onRead} /> : null}

      {isLoading ? <Spinner label="Loading listings…" /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load listings.
        </div>
      ) : null}

      {!isLoading && !error && (listings ?? []).length === 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-medium text-foreground">No listings yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Paste the alert emails or saved-search pages you already get in the inbox and
            we&apos;ll clean, cost, and rank every match.
          </p>
          <Link
            href={`/searches/${searchId}/inbox`}
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to the inbox →
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        {(listings ?? []).map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            targets={targets}
            onSave={(reason) => saveListing.mutate({ id: l.id, reason })}
            onDismiss={(reason) => dismissListing.mutate({ id: l.id, reason })}
          />
        ))}
      </div>
    </main>
  );
}

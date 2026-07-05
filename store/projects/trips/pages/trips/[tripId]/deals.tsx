import React, { useEffect, useState } from 'react';
import type { Deal } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { DealCard } from '../../../components/DealCard';
import { Spinner } from '../../../components/Spinner';

export default function TripDeals({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [polling, setPolling] = useState(false);

  const findDeals = useApiMutation<{ ok: true; runId: string }>('findDeals', {
    invalidates: ['listDeals'],
  });

  const { data, isLoading, error } = useApi<{ deals: Deal[] }>(
    'listDeals',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const deals = data?.deals ?? [];

  useEffect(() => {
    if (!polling) return;
    if (deals.length > 0) setPolling(false);
  }, [polling, deals.length]);

  const onFindDeals = async () => {
    try {
      await findDeals.mutate({ id: tripId });
      setPolling(true);
    } catch {
      // surfaced via findDeals.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="deals" />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Deals</h1>
        <button
          type="button"
          onClick={onFindDeals}
          disabled={findDeals.isPending || polling}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {findDeals.isPending || polling ? 'Hunting…' : 'Find deals'}
        </button>
      </div>

      {polling ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The deal-hunter is searching for savings…
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load deals.
        </div>
      ) : null}

      {!isLoading && !error && deals.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No deals found yet. Find deals to get started.
        </div>
      ) : null}

      <div className="space-y-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the deal-hunter</h2>
        <Chat agent="finance/deal-hunter" />
      </section>
    </main>
  );
}

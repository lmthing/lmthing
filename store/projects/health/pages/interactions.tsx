import React, { useEffect } from 'react';
import type { Interaction } from '@app/types';
import { useApi } from '@app/runtime';
import { InteractionCard } from '../components/InteractionCard';
import { Spinner } from '../components/Spinner';

export default function Interactions() {
  const { data: interactions, isLoading, error, refetch } = useApi<Interaction[]>('listInteractions', {});

  const hasPending = (interactions ?? []).some((i) => i.status === 'pending');

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [hasPending, refetch]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Interactions</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load interactions.
        </div>
      ) : null}

      {!isLoading && !error && (interactions ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No interaction findings yet.
        </div>
      ) : null}

      <div className="space-y-2">
        {(interactions ?? []).map((i) => (
          <InteractionCard key={i.id} interaction={i} />
        ))}
      </div>
    </main>
  );
}

import React, { useEffect } from 'react';
import type { Interaction } from '@app/types';
import { useApi } from '@app/runtime';
import { InteractionCard } from '../components/InteractionCard';
import { SkeletonList, EmptyState, ErrorNote, AIWorking } from '../components/states';

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

      {isLoading ? <SkeletonList rows={3} /> : null}

      {error ? <ErrorNote message="Failed to load interactions." onRetry={refetch} /> : null}

      {!isLoading && !error && (interactions ?? []).length === 0 ? (
        <EmptyState
          title="No interaction findings yet"
          hint="Open a medication and run “Check interactions” — the pharmacist screens it against your other medications."
          actions={[{ label: 'Go to medications', href: '/medications' }]}
        />
      ) : null}

      <div className="space-y-2">
        {(interactions ?? []).map((i) =>
          i.status === 'pending' ? (
            <AIWorking key={i.id} agent="The pharmacist" />
          ) : (
            <InteractionCard key={i.id} interaction={i} />
          ),
        )}
      </div>
    </main>
  );
}

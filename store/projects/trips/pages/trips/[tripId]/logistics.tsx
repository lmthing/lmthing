import React, { useEffect, useState } from 'react';
import type { TransitLeg, KnowledgeNote } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { TransitLegRow } from '../../../components/TransitLegRow';
import { NoteCard } from '../../../components/NoteCard';
import { Spinner } from '../../../components/Spinner';

export default function TripLogistics({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [polling, setPolling] = useState(false);

  const planTransit = useApiMutation<{ ok: true; runId: string }>('planTransit', {
    invalidates: ['transitLegs'],
  });

  const {
    data: legsData,
    isLoading: legsLoading,
    error: legsError,
  } = useApi<{ legs: (TransitLeg & { fromName?: string; toName?: string })[] }>(
    'transitLegs',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const { data: notesData } = useApi<{ notes: KnowledgeNote[] }>('tripNotes', { id: tripId });

  const legs = legsData?.legs ?? [];
  const notes = notesData?.notes ?? [];

  useEffect(() => {
    setPolling(!legsLoading && legs.length === 0);
  }, [legsLoading, legs.length]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="logistics" />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Logistics</h1>
        <button
          type="button"
          onClick={() => planTransit.mutate({ id: tripId })}
          disabled={planTransit.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {planTransit.isPending ? 'Planning…' : 'Plan transit'}
        </button>
      </div>

      {planTransit.isPending ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The navigator is planning your transit…
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Transit</h2>

        {legsLoading ? <Spinner /> : null}

        {legsError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load transit legs.
          </div>
        ) : null}

        {!legsLoading && !legsError && legs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No transit legs yet. Plan transit to get started.
          </div>
        ) : null}

        <div className="space-y-2">
          {legs.map((leg) => (
            <TransitLegRow key={leg.id} leg={leg} />
          ))}
        </div>
      </section>

      {notes.length > 0 ? (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Notes</h2>
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Refine with the navigator</h2>
        <Chat agent="logistics/navigator" />
      </section>
    </main>
  );
}

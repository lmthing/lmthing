import React from 'react';
import { useApi, Chat } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { SparklesIcon } from '../../../components/icons';

interface TripRow {
  id: string;
  title: string;
}

const SUGGESTIONS = [
  '€48 dinner at Ramiro, I paid, split with everyone',
  'Who owes what right now?',
  'Add Bob — vegetarian, hates early starts',
  'Pack for this trip',
  'Find a cheaper way to get between our stops',
  'Are we over budget?',
];

export default function TripAssistant({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data: trip } = useApi<TripRow>('getTrip', { id: tripId });

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col gap-4 p-6">
      <TripTabs tripId={tripId} active="assistant" />

      <div className="flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Trip Copilot</h1>
        {trip ? <span className="text-sm text-muted-foreground">· {trip.title}</span> : null}
      </div>

      <p className="text-sm text-muted-foreground">
        The write-capable assistant for this trip. It adds and splits expenses, adds travellers,
        generates packing, hunts deals, ingests confirmations, and answers money/planning questions —
        delegating the heavy work to the specialists. It confirms before anything destructive and
        never invents a booking.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <span
            key={s}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <Chat agent="copilot/assistant" />
      </div>
    </main>
  );
}

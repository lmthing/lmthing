import React from 'react';
import type { ItineraryItem, KnowledgeNote } from '@app/types';
import { useApi } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { ReminderRow } from '../../../components/ReminderRow';
import { NoteCard } from '../../../components/NoteCard';
import { Spinner } from '../../../components/Spinner';

type Reminder = ItineraryItem & { daysLeft: number | null; urgency: string };

export default function TripReminders({ params }: { params: { tripId: string } }) {
  const { tripId } = params;

  const {
    data: remindersData,
    isLoading: remindersLoading,
    error: remindersError,
  } = useApi<{ reminders: Reminder[] }>('tripReminders', { id: tripId });

  const { data: notesData } = useApi<{ notes: KnowledgeNote[] }>('tripNotes', { id: tripId });

  const reminders = remindersData?.reminders ?? [];
  const notes = notesData?.notes ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="reminders" />

      <h1 className="text-2xl font-bold text-foreground">Reminders</h1>

      <section className="space-y-3">
        {remindersLoading ? <Spinner /> : null}

        {remindersError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load reminders.
          </div>
        ) : null}

        {!remindersLoading && !remindersError && reminders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Nothing to book right now.
          </div>
        ) : null}

        <div className="space-y-2">
          {reminders.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} />
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
    </main>
  );
}

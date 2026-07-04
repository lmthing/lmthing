import React from 'react';
import type { KnowledgeNote } from '@app/types';
import { useApi } from '@app/runtime';
import { KnowledgeNoteCard } from '../components/KnowledgeNoteCard';
import { Spinner } from '../components/Spinner';

export default function Knowledge() {
  const { data: notes, isLoading, error } = useApi<KnowledgeNote[]>('listKnowledgeNotes', {});

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Knowledge</h1>

      <section className="space-y-3">
        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load knowledge notes.
          </div>
        ) : null}

        {!isLoading && !error && (notes ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No knowledge notes yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(notes ?? []).map((n) => (
            <KnowledgeNoteCard key={n.id} note={n} />
          ))}
        </div>
      </section>
    </main>
  );
}

import React from 'react';
import type { KnowledgeNote } from '@app/types';
import { useApi } from '@app/runtime';
import { KnowledgeNoteCard } from '../components/KnowledgeNoteCard';
import { SkeletonList, EmptyState, ErrorNote } from '../components/states';

export default function Knowledge() {
  const { data: notes, isLoading, error, refetch } = useApi<KnowledgeNote[]>('listKnowledgeNotes', {});

  const list = notes ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Knowledge</h1>

      <section className="space-y-3">
        {isLoading ? <SkeletonList rows={3} /> : null}

        {error ? <ErrorNote message="Failed to load knowledge notes." onRetry={refetch} /> : null}

        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            title="No knowledge notes yet"
            hint="Knowledge notes are written as your documents are analysed. Upload a document to start building your health knowledge base."
            actions={[{ label: 'Go to Documents', href: '/documents' }]}
          />
        ) : null}

        <div className="space-y-2">
          {list.map((n) => (
            <KnowledgeNoteCard key={n.id} note={n} />
          ))}
        </div>
      </section>
    </main>
  );
}

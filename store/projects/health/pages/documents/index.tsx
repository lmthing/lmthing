import React from 'react';
import type { Document } from '@app/types';
import { useApi } from '@app/runtime';
import { DocumentRow } from '../../components/DocumentRow';
import { UploadForm } from '../../components/UploadForm';
import { SkeletonList, EmptyState, ErrorNote, AIWorking } from '../../components/states';

export default function Documents() {
  const { data: documents, isLoading, error, refetch } = useApi<Document[]>('listDocuments', {});

  const list = documents ?? [];
  const isPending = (d: Document) => d.status === 'pending' || d.status === 'analyzing';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Documents</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Upload a document</h2>
        <UploadForm onUploaded={() => refetch()} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your documents</h2>

        {isLoading ? <SkeletonList rows={3} /> : null}

        {error ? <ErrorNote message="Failed to load documents." onRetry={refetch} /> : null}

        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            title="No documents uploaded yet"
            hint="Upload a lab PDF, discharge summary or visit note above and the analyst will extract results and write plain-language notes for you."
          />
        ) : null}

        <div className="space-y-2">
          {list.map((d) =>
            isPending(d) ? (
              <AIWorking
                key={d.id}
                agent="The analyst"
                label="Analyzing…"
                hint={`Reading “${d.filename}” — extractions and notes will appear here automatically.`}
              />
            ) : (
              <DocumentRow key={d.id} document={d} />
            ),
          )}
        </div>
      </section>
    </main>
  );
}

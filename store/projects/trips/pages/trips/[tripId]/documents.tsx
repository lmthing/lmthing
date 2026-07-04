import React, { useEffect, useState } from 'react';
import type { Document } from '@app/types';
import { useApi } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { DocumentUploadForm } from '../../../components/DocumentUploadForm';
import { DocumentRow } from '../../../components/DocumentRow';
import { Spinner } from '../../../components/Spinner';

export default function TripDocuments({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [polling, setPolling] = useState(false);

  const { data, isLoading, error, refetch } = useApi<{ documents: Document[] }>(
    'listDocuments',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const documents = data?.documents ?? [];

  useEffect(() => {
    setPolling(documents.some((d) => d.status === 'pending' || d.status === 'analyzing'));
  }, [documents]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="documents" />

      <h1 className="text-2xl font-bold text-foreground">Documents</h1>

      <DocumentUploadForm tripId={tripId} onUploaded={() => refetch()} />

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load documents.
        </div>
      ) : null}

      {!isLoading && !error && documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No documents yet. Paste one above to get started.
        </div>
      ) : null}

      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentRow key={doc.id} document={doc} />
        ))}
      </div>
    </main>
  );
}

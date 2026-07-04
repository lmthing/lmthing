import React from 'react';
import type { Document } from '@app/types';
import { useApi } from '@app/runtime';
import { DocumentRow } from '../../components/DocumentRow';
import { UploadForm } from '../../components/UploadForm';
import { Spinner } from '../../components/Spinner';

export default function Documents() {
  const { data: documents, isLoading, error, refetch } = useApi<Document[]>('listDocuments', {});

  const pending = (documents ?? []).some((d) => d.status === 'pending' || d.status === 'analyzing');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Documents</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Upload a document</h2>
        <UploadForm onUploaded={() => refetch()} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your documents</h2>

        {pending ? (
          <p className="text-sm text-muted-foreground">
            Some documents are still being analysed in the background — this page will update
            automatically.
          </p>
        ) : null}

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load documents.
          </div>
        ) : null}

        {!isLoading && !error && (documents ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No documents uploaded yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(documents ?? []).map((d) => (
            <DocumentRow key={d.id} document={d} />
          ))}
        </div>
      </section>
    </main>
  );
}

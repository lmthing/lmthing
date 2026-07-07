import React, { useEffect, useState } from 'react';
import type { Document, DocumentExtraction, KnowledgeNote } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { NoteCard } from '../../components/NoteCard';
import { Spinner } from '../../components/Spinner';

type Row = Record<string, unknown>;

interface DocumentDetail {
  document: Document;
  extractions: (DocumentExtraction & { row?: Row })[];
  notes: KnowledgeNote[];
}

function statusClass(status: string): string {
  if (status === 'analyzed') return 'text-primary';
  if (status === 'error') return 'text-destructive';
  return 'text-muted-foreground';
}

function rowTitle(row?: Row): string | undefined {
  if (!row) return undefined;
  return (
    (row.title as string) ??
    (row.name as string) ??
    (row.topic as string) ??
    (row.label as string) ??
    (row.provider as string) ??
    (row.description as string) ??
    (row.confirmation as string) ??
    (row.id as string)
  );
}

export default function DocumentDetailPage({ params }: { params: { docId: string } }) {
  const { docId } = params;
  const [polling, setPolling] = useState(false);

  const { data, isLoading, error } = useApi<DocumentDetail>(
    'getDocument',
    { id: docId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const document = data?.document;

  useEffect(() => {
    setPolling(document?.status === 'pending' || document?.status === 'analyzing');
  }, [document?.status]);

  if (isLoading && !document) return <Spinner />;

  if (error || !document) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load document.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href={`/trips/${document.tripId}/documents`}
        className="text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to documents
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {document.filename ?? document.kind}
          </h1>
          <p className="text-sm text-muted-foreground">{document.kind}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs ${statusClass(document.status)}`}
        >
          {document.status}
        </span>
      </div>

      {document.status === 'pending' || document.status === 'analyzing' ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The records analyst is reading this document…
        </div>
      ) : null}

      {document.status === 'error' && document.error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {document.error}
        </div>
      ) : null}

      {document.summary ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Summary</h2>
          <MarkdownBody source={document.summary} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Extractions</h2>
        {(data?.extractions ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No extractions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.extractions ?? []).map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {ex.table}
                  </span>
                  {rowTitle(ex.row) ? (
                    <p className="text-sm font-medium text-foreground">{rowTitle(ex.row)}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">row removed</p>
                  )}
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {Math.round((ex.confidence ?? 0) * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Notes</h2>
        {(data?.notes ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No notes from this document.
          </div>
        ) : (
          <div className="space-y-3">
            {(data?.notes ?? []).map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

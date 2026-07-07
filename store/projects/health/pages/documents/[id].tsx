import React, { useEffect } from 'react';
import type { Document, DocumentExtraction, KnowledgeNote } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { ExtractionList } from '../../components/ExtractionList';
import { KnowledgeNoteCard } from '../../components/KnowledgeNoteCard';
import { SkeletonList, ErrorNote, AIWorking } from '../../components/states';
import { fmtDate } from '../../components/format';

type DocumentDetail = Document & { extractions: DocumentExtraction[]; notes: KnowledgeNote[] };

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: document, isLoading, error, refetch } = useApi<DocumentDetail>('getDocument', { id });

  useEffect(() => {
    if (document?.status === 'analyzed' || document?.status === 'error') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [document?.status, refetch]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <SkeletonList rows={3} />
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <Link href="/documents" className="text-sm text-muted-foreground hover:text-primary">
            ← All documents
          </Link>
        </div>
        <ErrorNote message="Document not found." onRetry={refetch} />
      </main>
    );
  }

  const extractions = Array.isArray(document.extractions) ? document.extractions : [];
  const notes = Array.isArray(document.notes) ? document.notes : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/documents" className="text-sm text-muted-foreground hover:text-primary">
          ← All documents
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{document.filename}</h1>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {document.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Uploaded {fmtDate(document.uploadedAt)}</p>
      </div>

      {document.status === 'pending' || document.status === 'analyzing' ? (
        <AIWorking
          agent="The analyst"
          label="Analyzing…"
          hint="Reading your document and extracting results. This page updates automatically once analysis completes."
        />
      ) : null}

      {document.status === 'error' && document.error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {document.error}
        </div>
      ) : null}

      {document.summary ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Summary</h2>
          <div className="whitespace-pre-wrap text-sm text-foreground">{document.summary}</div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Extractions</h2>
        <ExtractionList extractions={extractions} />
      </section>

      {notes.length > 0 ? (
        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Knowledge notes</h2>
          <div className="space-y-2">
            {notes.map((n) => (
              <KnowledgeNoteCard key={n.id} note={n} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

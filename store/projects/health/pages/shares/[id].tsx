import React, { useEffect } from 'react';
import type { CareShare } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { SkeletonList, ErrorNote, AIWorking } from '../../components/states';
import { FileIcon } from '../../components/icons';
import { fmtDateTime } from '../../components/format';

export default function ShareDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: share, isLoading, error, refetch } = useApi<CareShare>('getShare', { id });

  useEffect(() => {
    if (share?.status !== 'pending') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [share?.status, refetch]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <SkeletonList rows={4} />
      </main>
    );
  }

  if (error || !share) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/shares" className="text-sm text-muted-foreground hover:text-primary">
          ← All summaries
        </Link>
        <ErrorNote message="Care summary not found." onRetry={refetch} />
      </main>
    );
  }

  const isPending = share.status === 'pending';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      {/* Print styles: hide chrome, keep the summary clean and legible on paper. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          .print-card { border: none !important; background: transparent !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/shares" className="text-sm text-muted-foreground hover:text-primary">
          ← All summaries
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <FileIcon className="h-4 w-4" />
          Print / Save PDF
        </button>
      </div>

      <article className="print-card space-y-6 rounded-lg border border-border bg-card p-6 text-foreground">
        <header className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileIcon className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Care summary · {share.scope}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{share.title}</h1>
          <p className="text-sm text-muted-foreground">Generated {fmtDateTime(share.createdAt)}</p>
          <span className="no-print inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {share.status}
          </span>
        </header>

        {isPending ? (
          <AIWorking agent="The coordinator" label="Compiling…" />
        ) : (
          <div className="leading-relaxed">
            <MarkdownBody markdown={share.body ?? ''} />
          </div>
        )}
      </article>
    </main>
  );
}

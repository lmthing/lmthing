import React, { useEffect } from 'react';
import type { CareShare } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

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

  if (isLoading) return <Spinner />;

  if (error || !share) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Care summary not found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/shares" className="text-sm text-muted-foreground hover:text-primary">
          ← All summaries
        </Link>
        <button
          type="button"
          disabled={share.status === 'pending'}
          onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Print
        </button>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">{share.title}</h1>
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {share.scope} · {share.status}
        </span>
      </div>

      {share.status === 'pending' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <Spinner label="Compiling care summary…" />
          <p className="text-sm text-muted-foreground">
            The coordinator is putting this together. This page will update automatically.
          </p>
        </div>
      ) : (
        <MarkdownBody markdown={share.body ?? ''} />
      )}
    </main>
  );
}

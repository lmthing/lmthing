import React, { useEffect } from 'react';
import type { Research } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

export default function ResearchDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: research, isLoading, error, refetch } = useApi<Research>('getResearch', { id });

  useEffect(() => {
    if (research?.status !== 'pending') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [research?.status, refetch]);

  if (isLoading) return <Spinner />;

  if (error || !research) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Research report not found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/labs" className="text-sm text-muted-foreground hover:text-primary">
          ← All labs
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{research.topic}</h1>
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {research.status}
        </span>
      </div>

      {research.status === 'pending' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <Spinner label="Researching…" />
          <p className="text-sm text-muted-foreground">
            The researcher is reading the literature. This page will update automatically.
          </p>
        </div>
      ) : (
        <MarkdownBody markdown={research.body ?? ''} />
      )}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the researcher</h2>
        <Chat agent="clinic/researcher" />
      </section>
    </main>
  );
}

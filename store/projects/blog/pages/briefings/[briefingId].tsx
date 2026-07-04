import React from 'react';
import { useApi, Chat, Link } from '@app/runtime';
import type { BriefingLike } from '../../components/BriefingCard';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

type BriefingDetail = BriefingLike & { body?: string };

export default function BriefingDetail({ params }: { params: { briefingId: string } }) {
  const { briefingId } = params;
  const {
    data: briefing,
    isLoading,
    error,
    refetch,
  } = useApi<BriefingDetail>('getBriefing', { id: briefingId });

  if (isLoading) return <Spinner />;

  if (error || !briefing) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load briefing.
        </div>
      </main>
    );
  }

  const statusClass =
    briefing.status === 'ready'
      ? 'bg-primary text-primary-foreground'
      : briefing.status === 'error'
        ? 'border border-destructive text-destructive'
        : 'border border-border text-muted-foreground';

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <Link href="/briefings" className="text-sm text-muted-foreground hover:text-primary">
          ← All briefings
        </Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">{briefing.title ?? briefing.topic}</h1>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
            {briefing.status ?? 'pending'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{briefing.topic}</p>
      </div>

      {briefing.status === 'pending' ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">The analyst is researching…</p>
          <button
            type="button"
            onClick={() => refetch?.()}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            Refresh
          </button>
        </section>
      ) : null}

      {briefing.body ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Findings</h2>
          <MarkdownBody markdown={briefing.body} />
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the analyst</h2>
        <Chat agent="research/analyst" />
      </section>
    </main>
  );
}

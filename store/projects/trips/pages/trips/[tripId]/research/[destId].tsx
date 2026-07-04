import React from 'react';
import type { Research } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { MarkdownBody } from '../../../../components/MarkdownBody';
import { Spinner } from '../../../../components/Spinner';

export default function DestinationResearch({
  params,
}: {
  params: { tripId: string; destId: string };
}) {
  const { tripId, destId } = params;
  const {
    data: research,
    isLoading,
    error,
  } = useApi<Research[]>('getResearch', { destId });

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <Link href={`/trips/${tripId}`} className="text-sm text-muted-foreground hover:text-primary">
          ← Back to timeline
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Research</h1>
      </div>

      <section className="space-y-3">
        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load research.
          </div>
        ) : null}

        {!isLoading && !error && (research ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No research yet. Ask the researcher below for a deep dive.
          </div>
        ) : null}

        <div className="space-y-4">
          {(research ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{r.topic}</span>
                {r.status !== 'ready' ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {r.status}
                  </span>
                ) : null}
              </div>
              <MarkdownBody source={r.body ?? ''} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the researcher</h2>
        <Chat agent="concierge/researcher" />
      </section>
    </main>
  );
}

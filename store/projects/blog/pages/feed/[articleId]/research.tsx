import React, { useEffect, useState } from 'react';
import type { Research } from '@app/types';
import { useApi, useApiMutation, Chat, Link } from '@app/runtime';
import { Spinner } from '../../../components/Spinner';
import { MarkdownBody } from '../../../components/MarkdownBody';

export default function ResearchPage({ params }: { params: { articleId: string } }) {
  const { articleId } = params;
  const { data: research, isLoading, error, refetch } = useApi<Research[]>('getResearch', { id: articleId });

  // Stream-in effect (§2.1): while a deep-dive is still pending, poll so the
  // report appears to compose live rather than the user watching a static badge.
  const anyPending = (research ?? []).some((r) => r.status === 'pending');
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => refetch?.(), 3000);
    return () => clearInterval(id);
  }, [anyPending, refetch]);

  const requestResearch = useApiMutation<{ researchId: string; status: string }>('requestResearch', {
    invalidates: ['getResearch'],
  });

  const [topic, setTopic] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    try {
      await requestResearch.mutate({ id: articleId, topic: topic.trim() });
      setTopic('');
      refetch?.();
    } catch {
      // surfaced via requestResearch.error below
    }
  };

  const upgradeNeeded =
    !!requestResearch.error &&
    /402|upgrade|budget|limit/i.test((requestResearch.error as { message?: string })?.message ?? '');

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <Link href={`/feed/${articleId}`} className="text-sm text-muted-foreground hover:text-primary">
          ← Back to article
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Research</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Request a deep dive</h2>
        <form onSubmit={onSubmit} className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic to research further…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={requestResearch.isPending || !topic.trim()}
            className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {requestResearch.isPending ? 'Requesting…' : 'Request deep dive'}
          </button>
        </form>
        {requestResearch.error ? (
          <p className="text-sm text-destructive">
            {upgradeNeeded
              ? 'Deep-dive research requires a higher tier. Upgrade in Preferences to continue.'
              : (requestResearch.error as { message?: string })?.message ?? 'Failed to request research.'}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Findings</h2>

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load research.
          </div>
        ) : null}
        {!isLoading && !error && (research ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No research yet. Request a deep dive above.
          </div>
        ) : null}

        <div className="space-y-3">
          {(research ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{r.topic}</span>
                <span
                  className={
                    r.status === 'pending'
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
                      : 'rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
                  }
                >
                  {r.status === 'pending' ? (
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  ) : null}
                  {r.status === 'pending' ? 'composing…' : r.status}
                </span>
              </div>
              {r.body ? (
                <div className="text-sm">
                  <MarkdownBody markdown={r.body} />
                </div>
              ) : r.status === 'pending' ? (
                <p className="text-sm text-muted-foreground">The researcher is surveying sources…</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the researcher</h2>
        <Chat agent="newsroom/researcher" />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Fact-check a claim</h2>
        <p className="text-sm text-muted-foreground">
          Paste a claim from this article and the fact-checker will triage and verify it against
          real sources.
        </p>
        <Chat agent="research/fact-checker" />
      </section>
    </main>
  );
}

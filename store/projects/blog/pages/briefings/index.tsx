import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { BriefingCard, type BriefingLike } from '../../components/BriefingCard';
import { Spinner } from '../../components/Spinner';

export default function Briefings() {
  const { data: briefings, isLoading, error } = useApi<BriefingLike[]>('listBriefings', {});

  const requestBriefing = useApiMutation<BriefingLike>('requestBriefing', {
    invalidates: ['listBriefings'],
  });

  const [topic, setTopic] = useState('');

  const onCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    try {
      await requestBriefing.mutate({ topic: topic.trim() });
      setTopic('');
    } catch {
      // error surfaced below via requestBriefing.error
    }
  };

  const pendingBriefings = (briefings ?? []).filter((b) => b.status === 'pending');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Briefings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Commission a briefing</h2>
        <form onSubmit={onCommission} className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic to brief on…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={requestBriefing.isPending || !topic.trim()}
            className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {requestBriefing.isPending ? 'Commissioning…' : 'Commission briefing'}
          </button>
        </form>
        {requestBriefing.error ? (
          <p className="text-sm text-destructive">
            {(requestBriefing.error as { message?: string })?.message ?? 'Failed to commission briefing.'}
          </p>
        ) : null}
      </section>

      {pendingBriefings.length > 0 ? (
        <p className="text-sm text-muted-foreground">The analyst is researching…</p>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load briefings.
        </div>
      ) : null}

      {!isLoading && !error && (briefings ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No briefings yet. Commission one above.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(briefings ?? []).map((b) => (
          <BriefingCard key={b.id} briefing={b} />
        ))}
      </div>
    </main>
  );
}

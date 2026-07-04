import React from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { InsightsPanel, type InsightsLike } from '../components/InsightsPanel';
import { Spinner } from '../components/Spinner';

export default function Insights() {
  const { data: insights, isLoading, error } = useApi<InsightsLike>('feedInsights', {});

  const personalizeFeed = useApiMutation<{ ok: boolean }>('personalizeFeed', {});

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Insights</h1>
        <button
          type="button"
          disabled={personalizeFeed.isPending}
          onClick={() => personalizeFeed.mutate({})}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {personalizeFeed.isPending ? 'Re-personalizing…' : 'Re-personalize feed'}
        </button>
      </div>

      {personalizeFeed.error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {(personalizeFeed.error as { message?: string })?.message ?? 'Failed to re-personalize feed.'}
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load insights.
        </div>
      ) : null}

      {!isLoading && !error && insights ? <InsightsPanel insights={insights} /> : null}
    </main>
  );
}

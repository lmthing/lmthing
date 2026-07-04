import React from 'react';
import type { Insight } from '@app/types';
import { useApi } from '@app/runtime';
import { InsightCard } from '../components/InsightCard';
import { Spinner } from '../components/Spinner';

export default function Insights() {
  const { data: insights, isLoading, error } = useApi<Insight[]>('listInsights', {});

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Insights</h1>

      <section className="space-y-3">
        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load insights.
          </div>
        ) : null}

        {!isLoading && !error && (insights ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No insights yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(insights ?? []).map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      </section>
    </main>
  );
}

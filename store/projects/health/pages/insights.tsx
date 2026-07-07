import React from 'react';
import type { Insight } from '@app/types';
import { useApi } from '@app/runtime';
import { InsightCard } from '../components/InsightCard';
import { SkeletonList, EmptyState, ErrorNote } from '../components/states';

export default function Insights() {
  const { data: insights, isLoading, error, refetch } = useApi<Insight[]>('listInsights', {});

  const list = insights ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Insights</h1>

      <section className="space-y-3">
        {isLoading ? <SkeletonList rows={3} /> : null}

        {error ? <ErrorNote message="Failed to load insights." onRetry={refetch} /> : null}

        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            title="No insights yet"
            hint="Insights are generated from your labs, symptoms and documents. Add some data and the analyst will surface patterns here."
            actions={[
              { label: 'Log a symptom', href: '/symptoms' },
              { label: 'Upload a document', href: '/documents' },
            ]}
          />
        ) : null}

        <div className="space-y-2">
          {list.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      </section>
    </main>
  );
}

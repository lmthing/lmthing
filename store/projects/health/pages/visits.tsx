import React from 'react';
import type { VisitBrief } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { VisitBriefCard } from '../components/VisitBriefCard';
import { SkeletonList, EmptyState, ErrorNote, AIWorking } from '../components/states';

export default function Visits() {
  const { data: briefs, isLoading, error, refetch } = useApi<VisitBrief[]>('listVisitBriefs', {});

  const prepareVisit = useApiMutation<VisitBrief>('prepareVisit', {
    invalidates: ['listVisitBriefs'],
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Visits</h1>
        <button
          type="button"
          disabled={prepareVisit.isPending}
          onClick={() => prepareVisit.mutate({})}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {prepareVisit.isPending ? 'Preparing…' : 'Prepare a new brief'}
        </button>
      </div>

      {prepareVisit.error ? (
        <ErrorNote
          message={(prepareVisit.error as { message?: string })?.message ?? 'Failed to prepare visit brief.'}
        />
      ) : null}

      <section className="space-y-3">
        {isLoading ? <SkeletonList rows={2} /> : null}

        {error ? <ErrorNote message="Failed to load visit briefs." onRetry={refetch} /> : null}

        {!isLoading && !error && (briefs ?? []).length === 0 ? (
          <EmptyState
            title="No visit briefs yet"
            hint="Prepare a brief and the interpreter will summarize your recent labs, meds, and symptoms for your next visit."
            actions={[
              {
                label: prepareVisit.isPending ? 'Preparing…' : 'Prepare a new brief',
                onClick: () => prepareVisit.mutate({}),
              },
            ]}
          />
        ) : null}

        <div className="space-y-3">
          {(briefs ?? []).map((b) =>
            b.status === 'pending' ? (
              <AIWorking key={b.id} agent="The interpreter" label="Preparing brief…" />
            ) : (
              <VisitBriefCard key={b.id} brief={b} />
            ),
          )}
        </div>
      </section>
    </main>
  );
}

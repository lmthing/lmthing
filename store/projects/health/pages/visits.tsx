import React from 'react';
import type { VisitBrief } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { VisitBriefCard } from '../components/VisitBriefCard';
import { Spinner } from '../components/Spinner';

export default function Visits() {
  const { data: briefs, isLoading, error } = useApi<VisitBrief[]>('listVisitBriefs', {});

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
        <p className="text-sm text-destructive">
          {(prepareVisit.error as { message?: string })?.message ?? 'Failed to prepare visit brief.'}
        </p>
      ) : null}

      <section className="space-y-3">
        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load visit briefs.
          </div>
        ) : null}

        {!isLoading && !error && (briefs ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No visit briefs yet.
          </div>
        ) : null}

        <div className="space-y-3">
          {(briefs ?? []).map((b) => (
            <VisitBriefCard key={b.id} brief={b} />
          ))}
        </div>
      </section>
    </main>
  );
}

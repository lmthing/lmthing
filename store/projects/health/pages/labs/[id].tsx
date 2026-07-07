import React from 'react';
import type { LabResult, Research } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { FlagBadge } from '../../components/FlagBadge';
import { Spinner } from '../../components/Spinner';
import { fmtDate } from '../../components/format';

type LabDetail = LabResult & { research: Research[] };

export default function LabDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: lab, isLoading, error } = useApi<LabDetail>('getLab', { id });

  const requestResearch = useApiMutation<{ researchId: string; status: string }>('requestResearch', {
    invalidates: ['getLab'],
  });

  if (isLoading) return <Spinner />;

  if (error || !lab) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Lab result not found.
        </div>
      </main>
    );
  }

  const hasLow = lab.refLow != null;
  const hasHigh = lab.refHigh != null;
  const research = Array.isArray(lab.research) ? lab.research : [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/labs" className="text-sm text-muted-foreground hover:text-primary">
          ← All labs
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            {lab.panel} · {lab.analyte}
          </h1>
          <FlagBadge flag={lab.flag} />
        </div>
        <p className="text-muted-foreground">
          {lab.value} {lab.unit}
          {hasLow || hasHigh ? ` (ref ${hasLow ? lab.refLow : '—'}–${hasHigh ? lab.refHigh : '—'})` : ''}
        </p>
        <p className="text-sm text-muted-foreground">Taken {fmtDate(lab.takenAt)}</p>
        {lab.note ? <p className="text-sm text-foreground">{lab.note}</p> : null}
      </div>

      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Research</h2>
          <button
            type="button"
            disabled={requestResearch.isPending}
            onClick={() =>
              requestResearch.mutate({
                topic: `${lab.analyte} ${lab.panel}`,
                labResultId: lab.id,
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {requestResearch.isPending ? 'Requesting…' : 'Request deep dive'}
          </button>
        </div>

        {requestResearch.error ? (
          <p className="text-sm text-destructive">
            {(requestResearch.error as { message?: string })?.message ??
              'Failed to request research.'}
          </p>
        ) : null}

        {research.length === 0 ? (
          <p className="text-sm text-muted-foreground">No research yet for this result.</p>
        ) : (
          <div className="space-y-2">
            {research.map((r) => (
              <Link
                key={r.id}
                href={`/research/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{r.topic}</span>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                  {r.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

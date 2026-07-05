import React, { useEffect } from 'react';
import type { TriageAssessment } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { UrgencyBadge } from '../../components/UrgencyBadge';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

export default function TriageDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: assessment, isLoading, error, refetch } = useApi<TriageAssessment>('getTriage', { id });

  useEffect(() => {
    if (assessment?.status !== 'pending') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [assessment?.status, refetch]);

  if (isLoading) return <Spinner />;

  if (error || !assessment) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Triage assessment not found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/triage" className="text-sm text-muted-foreground hover:text-primary">
          ← All assessments
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground">{assessment.question}</h1>
          <UrgencyBadge urgency={assessment.urgency} />
        </div>
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {assessment.status}
        </span>
      </div>

      {assessment.urgency === 'emergency' ? (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm font-medium text-destructive">
          This may need urgent care — contact a clinician or emergency services.
        </div>
      ) : null}

      {assessment.status === 'pending' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <Spinner label="Assessing…" />
          <p className="text-sm text-muted-foreground">
            The triage nurse is reviewing this. This page will update automatically.
          </p>
        </div>
      ) : (
        <MarkdownBody markdown={assessment.body ?? ''} />
      )}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the triage nurse</h2>
        <Chat agent="care/triage-nurse" />
      </section>
    </main>
  );
}

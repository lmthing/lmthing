import React, { useEffect } from 'react';
import type { TriageAssessment } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { UrgencyBadge } from '../../components/UrgencyBadge';
import { MarkdownBody } from '../../components/MarkdownBody';
import { EmergencyContact } from '../../components/EmergencyContact';
import { AIWorking, ErrorNote, SkeletonList } from '../../components/states';

function cardTone(urgency: string): string {
  if (urgency === 'emergency') return 'border-destructive/50 bg-destructive/5';
  if (urgency === 'urgent') return 'border-warning/50 bg-warning/5';
  return 'border-border bg-card';
}

export default function TriageDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: assessment, isLoading, error, refetch } = useApi<TriageAssessment>('getTriage', { id });

  useEffect(() => {
    if (assessment?.status !== 'pending') return;
    const interval = setInterval(() => refetch(), 4000);
    return () => clearInterval(interval);
  }, [assessment?.status, refetch]);

  if (isLoading) return <main className="mx-auto max-w-2xl p-6"><SkeletonList rows={2} /></main>;

  if (error || !assessment) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <ErrorNote message="Triage assessment not found." onRetry={refetch} />
      </main>
    );
  }

  const serious = assessment.urgency === 'emergency' || assessment.urgency === 'urgent';

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/triage" className="text-sm text-muted-foreground hover:text-primary">
          ← All assessments
        </Link>
      </div>

      {/* Urgency and the "seek care now" line are pulled to the very top, unmissable. */}
      {serious ? <EmergencyContact emphatic /> : null}

      <div className={`space-y-3 rounded-lg border p-4 ${cardTone(assessment.urgency)}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground">{assessment.question}</h1>
          <UrgencyBadge urgency={assessment.urgency} />
        </div>
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {assessment.status}
        </span>
      </div>

      {assessment.status === 'pending' ? (
        <AIWorking agent="The triage nurse" label="Assessing…" hint="A conservative, knowledge-grounded read — usually ~30s. This page updates automatically." />
      ) : (
        <MarkdownBody markdown={assessment.body ?? ''} />
      )}

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Triage is a conservative, informational read of your symptom — never a diagnosis. When in
        doubt, contact a clinician. Not medical advice.
      </p>

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the triage nurse</h2>
        <Chat agent="care/triage-nurse" />
      </section>
    </main>
  );
}

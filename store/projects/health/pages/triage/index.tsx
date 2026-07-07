import React, { useState } from 'react';
import type { TriageAssessment } from '@app/types';
import { useApi, useApiMutation, navigate } from '@app/runtime';
import { TriageCard } from '../../components/TriageCard';
import { EmergencyContact } from '../../components/EmergencyContact';
import { SkeletonList, EmptyState, ErrorNote } from '../../components/states';
import { AlertIcon } from '../../components/icons';

export default function Triage() {
  const { data: assessments, isLoading, error, refetch } = useApi<TriageAssessment[]>('listTriage', {});

  const requestTriage = useApiMutation<{ triageId: string; status: string }>('requestTriage', {
    invalidates: ['listTriage', 'getAttention'],
  });

  const [question, setQuestion] = useState('');

  const onAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      const created = await requestTriage.mutate({ question: question.trim() });
      setQuestion('');
      navigate(`/triage/${created.triageId}`);
    } catch {
      // surfaced via requestTriage.error below
    }
  };

  const list = assessments ?? [];
  const hasSerious = list.some((t) => t.urgency === 'emergency' || t.urgency === 'urgent');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Symptom triage</h1>

      {hasSerious ? <EmergencyContact emphatic /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask a triage question</h2>
        <form onSubmit={onAsk} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. chest tightness after climbing stairs"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="submit"
              disabled={requestTriage.isPending || !question.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {requestTriage.isPending ? 'Asking…' : 'Ask'}
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlertIcon className="h-3.5 w-3.5" /> Triage is free — safety is never paywalled.
            </span>
          </div>
          {requestTriage.error ? (
            <ErrorNote
              message={(requestTriage.error as { message?: string })?.message ?? 'Failed to request triage.'}
            />
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Past assessments</h2>

        {isLoading ? <SkeletonList rows={3} /> : null}
        {error ? <ErrorNote message="Failed to load triage assessments." onRetry={refetch} /> : null}

        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            title="No triage assessments yet"
            hint="Describe a symptom above and the triage nurse will give a conservative, plain-language read of how urgent it is."
          />
        ) : null}

        <div className="space-y-2">
          {list.map((t) => (
            <TriageCard key={t.id} assessment={t} />
          ))}
        </div>
      </section>
    </main>
  );
}

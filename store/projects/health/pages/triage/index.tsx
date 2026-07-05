import React, { useState } from 'react';
import type { TriageAssessment } from '@app/types';
import { useApi, useApiMutation, navigate } from '@app/runtime';
import { TriageCard } from '../../components/TriageCard';
import { Spinner } from '../../components/Spinner';

export default function Triage() {
  const { data: assessments, isLoading, error } = useApi<TriageAssessment[]>('listTriage', {});

  const requestTriage = useApiMutation<TriageAssessment>('requestTriage', {
    invalidates: ['listTriage'],
  });

  const [question, setQuestion] = useState('');

  const onAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      const created = await requestTriage.mutate({ question: question.trim() });
      setQuestion('');
      navigate(`/triage/${created.id}`);
    } catch {
      // surfaced via requestTriage.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Symptom triage</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask a triage question</h2>
        <form onSubmit={onAsk} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. chest tightness after climbing stairs"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={requestTriage.isPending || !question.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {requestTriage.isPending ? 'Asking…' : 'Ask'}
          </button>
          {requestTriage.error ? (
            <p className="text-sm text-destructive">
              {(requestTriage.error as { message?: string })?.message ?? 'Failed to request triage.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Past assessments</h2>

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load triage assessments.
          </div>
        ) : null}

        {!isLoading && !error && (assessments ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No triage assessments yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(assessments ?? []).map((t) => (
            <TriageCard key={t.id} assessment={t} />
          ))}
        </div>
      </section>
    </main>
  );
}

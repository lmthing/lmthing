import React, { useState } from 'react';
import type { Symptom } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { SymptomRow } from '../components/SymptomRow';
import { Spinner } from '../components/Spinner';

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function Symptoms() {
  const { data: symptoms, isLoading, error } = useApi<Symptom[]>('listSymptoms', {});

  const logSymptom = useApiMutation<Symptom>('logSymptom', {
    invalidates: ['listSymptoms'],
  });

  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('1');
  const [startedAt, setStartedAt] = useState(nowLocal());

  const onLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await logSymptom.mutate({
        name: name.trim(),
        severity: Number(severity),
        startedAt: new Date(startedAt).toISOString(),
      });
      setName('');
      setSeverity('1');
      setStartedAt(nowLocal());
    } catch {
      // surfaced via logSymptom.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Symptoms</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Log a symptom</h2>
        <form onSubmit={onLog} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Symptom (e.g. headache)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="1">1 — mild</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5 — severe</option>
            </select>
          </div>
          <input
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            type="datetime-local"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={logSymptom.isPending || !name.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {logSymptom.isPending ? 'Logging…' : 'Log symptom'}
          </button>
          {logSymptom.error ? (
            <p className="text-sm text-destructive">
              {(logSymptom.error as { message?: string })?.message ?? 'Failed to log symptom.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">History</h2>

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load symptoms.
          </div>
        ) : null}

        {!isLoading && !error && (symptoms ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No symptoms logged yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(symptoms ?? []).map((s) => (
            <SymptomRow key={s.id} symptom={s} />
          ))}
        </div>
      </section>
    </main>
  );
}

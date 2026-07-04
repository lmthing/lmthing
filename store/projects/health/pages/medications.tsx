import React, { useState } from 'react';
import type { Medication } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { MedicationRow } from '../components/MedicationRow';
import { Spinner } from '../components/Spinner';

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function Medications() {
  const { data: medications, isLoading, error } = useApi<Medication[]>('listMedications', {});

  const addMedication = useApiMutation<Medication>('addMedication', {
    invalidates: ['listMedications'],
  });

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [schedule, setSchedule] = useState('');
  const [startedAt, setStartedAt] = useState(nowLocal());

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMedication.mutate({
        name: name.trim(),
        dose: dose.trim() || undefined,
        schedule: schedule.trim() || undefined,
        startedAt: new Date(startedAt).toISOString(),
      });
      setName('');
      setDose('');
      setSchedule('');
      setStartedAt(nowLocal());
    } catch {
      // surfaced via addMedication.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Medications</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add a medication</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Metformin)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="Dose (e.g. 500mg)"
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Schedule (e.g. twice daily)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <input
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            type="datetime-local"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={addMedication.isPending || !name.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addMedication.isPending ? 'Adding…' : 'Add medication'}
          </button>
          {addMedication.error ? (
            <p className="text-sm text-destructive">
              {(addMedication.error as { message?: string })?.message ?? 'Failed to add medication.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Current & past medications</h2>

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load medications.
          </div>
        ) : null}

        {!isLoading && !error && (medications ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No medications logged yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(medications ?? []).map((m) => (
            <MedicationRow key={m.id} medication={m} />
          ))}
        </div>
      </section>
    </main>
  );
}

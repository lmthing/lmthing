import React, { useState } from 'react';
import type { Appointment } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { AppointmentRow } from '../../components/AppointmentRow';
import { Spinner } from '../../components/Spinner';

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function Appointments() {
  const { data: appointments, isLoading, error } = useApi<Appointment[]>('listAppointments', {});

  const addAppointment = useApiMutation<Appointment>('addAppointment', {
    invalidates: ['listAppointments'],
  });

  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [kind, setKind] = useState('doctor');
  const [scheduledAt, setScheduledAt] = useState(nowLocal());

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await addAppointment.mutate({
        title: title.trim(),
        provider: provider.trim() || undefined,
        kind,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setTitle('');
      setProvider('');
      setKind('doctor');
      setScheduledAt(nowLocal());
    } catch {
      // surfaced via addAppointment.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Appointments</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add an appointment</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Cardiology follow-up)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider (optional)"
              className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="doctor">Doctor</option>
              <option value="lab">Lab</option>
              <option value="imaging">Imaging</option>
              <option value="dental">Dental</option>
              <option value="other">Other</option>
            </select>
            <input
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              type="datetime-local"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addAppointment.isPending || !title.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addAppointment.isPending ? 'Adding…' : 'Add appointment'}
          </button>
          {addAppointment.error ? (
            <p className="text-sm text-destructive">
              {(addAppointment.error as { message?: string })?.message ?? 'Failed to add appointment.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Upcoming & past</h2>

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load appointments.
          </div>
        ) : null}

        {!isLoading && !error && (appointments ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No appointments yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(appointments ?? []).map((a) => (
            <AppointmentRow key={a.id} appointment={a} />
          ))}
        </div>
      </section>
    </main>
  );
}

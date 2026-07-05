import React from 'react';
import type { Appointment } from '@app/types';
import { useApi, useApiMutation, Chat, Link } from '@app/runtime';
import { AppointmentCard } from '../../components/AppointmentCard';
import { Spinner } from '../../components/Spinner';

const STATUSES = ['scheduled', 'completed', 'cancelled'] as const;

export default function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: appointments, isLoading, error } = useApi<Appointment[]>('listAppointments', {});

  const updateAppointment = useApiMutation<Appointment>('updateAppointment', {
    invalidates: ['listAppointments'],
  });

  if (isLoading) return <Spinner />;

  const appointment = (appointments ?? []).find((a) => a.id === id);

  if (error || !appointment) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Appointment not found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/appointments" className="text-sm text-muted-foreground hover:text-primary">
          ← All appointments
        </Link>
      </div>

      <AppointmentCard appointment={appointment} />

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Status</h2>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={updateAppointment.isPending || appointment.status === s}
              onClick={() => updateAppointment.mutate({ id: appointment.id, status: s })}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        {updateAppointment.error ? (
          <p className="text-sm text-destructive">
            {(updateAppointment.error as { message?: string })?.message ?? 'Failed to update appointment.'}
          </p>
        ) : null}
      </section>

      {appointment.prepBriefId ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Visit prep</h2>
          <p className="text-sm text-muted-foreground">
            A visit brief has been prepared for this appointment (id {appointment.prepBriefId}).
          </p>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the coordinator</h2>
        <Chat agent="care/coordinator" />
      </section>
    </main>
  );
}

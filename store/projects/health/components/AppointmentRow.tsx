import React from 'react';
import type { Appointment } from '@app/types';
import { Link } from '@app/runtime';
import { fmtDateTime } from './format';

function statusClasses(status: string) {
  if (status === 'completed') return 'bg-success text-success-foreground';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{appointment.title}</p>
        <p className="text-sm text-muted-foreground">
          {appointment.provider ? `${appointment.provider} · ` : ''}
          {appointment.kind} · {fmtDateTime(appointment.scheduledAt)}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(appointment.status)}`}>
        {appointment.status}
      </span>
    </Link>
  );
}

export default AppointmentRow;

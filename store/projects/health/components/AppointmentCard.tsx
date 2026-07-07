import React from 'react';
import type { Appointment } from '@app/types';
import { fmtDateTime } from './format';

function statusClasses(status: string) {
  if (status === 'completed') return 'bg-success text-success-foreground';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{appointment.title}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(appointment.status)}`}>
          {appointment.status}
        </span>
      </div>
      <p className="text-sm uppercase text-muted-foreground">{appointment.kind}</p>
      {appointment.provider ? <p className="text-foreground">{appointment.provider}</p> : null}
      {appointment.location ? <p className="text-sm text-muted-foreground">{appointment.location}</p> : null}
      <p className="text-sm text-muted-foreground">Scheduled {fmtDateTime(appointment.scheduledAt)}</p>
      {appointment.note ? <p className="text-sm text-foreground">{appointment.note}</p> : null}
    </div>
  );
}

export default AppointmentCard;

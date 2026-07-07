import React, { useState } from 'react';
import type { Medication } from '@app/types';
import { Link, useApi, useApiMutation } from '@app/runtime';
import { fmtTime, fmtRelative } from './format';
import { EmptyState, SkeletonList } from './states';
import { CheckIcon, PillIcon, BellIcon, CalendarIcon } from './icons';

interface AdherenceLog {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: string;
}
interface Followup {
  id: string;
  topic: string;
  dueAt: string;
  done: boolean;
}
interface Appointment {
  id: string;
  title: string;
  provider?: string;
  scheduledAt: string;
  status: string;
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** A compact, actionable checklist: doses to confirm, follow-ups due, appointments today. */
export function TodayPlan() {
  const doses = useApi<AdherenceLog[]>('listDoses', { dueOnly: true });
  const meds = useApi<Medication[]>('listMedications', {});
  const followups = useApi<Followup[]>('listFollowups', { dueOnly: true });
  const appts = useApi<Appointment[]>('listAppointments', { upcomingOnly: true });

  const logDose = useApiMutation('logDose', { invalidates: ['listDoses', 'getAttention'] });
  const completeFollowup = useApiMutation('completeFollowup', {
    invalidates: ['listFollowups', 'getAttention'],
  });
  const [marking, setMarking] = useState<string | null>(null);

  const loading = doses.isLoading || meds.isLoading || followups.isLoading || appts.isLoading;
  if (loading) return <SkeletonList rows={3} />;

  const medName = (id: string) => (meds.data ?? []).find((m) => m.id === id)?.name ?? 'Medication';
  const dueDoses = (doses.data ?? []).filter((d) => isToday(d.scheduledAt) || d.status === 'missed').slice(0, 6);
  const dueFollowups = (followups.data ?? []).slice(0, 5);
  const todayAppts = (appts.data ?? []).filter((a) => isToday(a.scheduledAt));

  const empty = dueDoses.length === 0 && dueFollowups.length === 0 && todayAppts.length === 0;
  if (empty) {
    return (
      <EmptyState
        tone="clear"
        title="Nothing on today's plan"
        hint="No doses to confirm, follow-ups due, or appointments today."
      />
    );
  }

  const onMark = async (id: string) => {
    setMarking(id);
    try {
      await logDose.mutate({ medicationId: id, status: 'taken' });
    } finally {
      setMarking(null);
    }
  };

  return (
    <div className="space-y-2">
      {dueDoses.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-muted-foreground">
              <PillIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{medName(d.medicationId)}</p>
              <p className="text-xs text-muted-foreground">
                {d.status === 'missed' ? 'Missed · ' : ''}
                {fmtTime(d.scheduledAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onMark(d.medicationId)}
            disabled={marking === d.medicationId}
            className="inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            {marking === d.medicationId ? 'Saving…' : 'Taken'}
          </button>
        </div>
      ))}

      {dueFollowups.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-muted-foreground">
              <BellIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{f.topic}</p>
              <p className="text-xs text-muted-foreground">Due {fmtRelative(f.dueAt)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => completeFollowup.mutate({ id: f.id })}
            disabled={completeFollowup.isPending}
            className="inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            Done
          </button>
        </div>
      ))}

      {todayAppts.map((a) => (
        <Link
          key={a.id}
          href="/appointments"
          className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 hover:bg-muted"
        >
          <span className="text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
            <p className="text-xs text-muted-foreground">
              Today {fmtTime(a.scheduledAt)}
              {a.provider ? ` · ${a.provider}` : ''}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default TodayPlan;

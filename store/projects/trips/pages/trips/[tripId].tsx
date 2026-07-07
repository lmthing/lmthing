import React from 'react';
import { useApi, useApiMutation, navigate, Link } from '@app/runtime';
import { BudgetStrip } from '../../components/BudgetStrip';
import { FinanceBar } from '../../components/FinanceBar';
import { RunStrip } from '../../components/RunStrip';
import { CopilotDock } from '../../components/CopilotDock';
import { SkeletonList, Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { TripTabs } from '../../components/TripTabs';
import { formatDate, formatDateRange, formatMoney } from '../../components/format';
import { kindStyle } from '../../components/kind';
import {
  MapPinIcon,
  BellIcon,
  TagIcon,
  FileIcon,
  ScaleIcon,
  ClockIcon,
  TrashIcon,
  CalendarIcon,
} from '../../components/icons';

interface TripItem {
  id: string;
  destinationId: string;
  day: string;
  startTime?: string;
  kind: string;
  title: string;
  location?: string;
}
interface TripDest {
  id: string;
  name: string;
  items: TripItem[];
}
interface FullTrip {
  id: string;
  title: string;
  brief: string;
  startDate?: string;
  endDate?: string;
  status: string;
  destinations: TripDest[];
}
interface Traveler {
  id: string;
  name: string;
}
interface Reminder {
  id: string;
  title: string;
  bookByDate?: string;
  daysLeft: number | null;
  urgency: string;
}
interface Deal {
  id: string;
  title: string;
  estimatedSavings: number;
  currency: string;
  status: string;
}
interface DocRow {
  id: string;
  filename?: string;
  status: string;
}
interface Finances {
  homeCurrency: string;
  budget: number;
  booked: number;
  spent: number;
  remaining: number;
}
interface Settlement {
  transfers: { fromName: string; toName: string; amount: number }[];
  currency: string;
}

function countdown(startDate?: string, status?: string): string {
  if (status === 'complete') return 'Completed';
  if (!startDate) return status === 'booked' ? 'Booked' : 'Planning';
  const days = Math.ceil((new Date(startDate).getTime() - Date.now()) / 86400000);
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return 'in progress';
}

function Avatars({ travelers }: { travelers: Traveler[] }) {
  if (travelers.length === 0) return null;
  return (
    <div className="flex -space-x-2">
      {travelers.slice(0, 5).map((t) => (
        <span
          key={t.id}
          title={t.name}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium text-foreground"
        >
          {t.name.slice(0, 2).toUpperCase()}
        </span>
      ))}
      {travelers.length > 5 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-xs text-muted-foreground">
          +{travelers.length - 5}
        </span>
      ) : null}
    </div>
  );
}

export default function TripOverview({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data: trip, isLoading, error, refetch } = useApi<FullTrip>('getTrip', { id: tripId });
  const { data: travelersRes } = useApi<{ travelers: Traveler[] }>('listTravelers', { id: tripId });
  const { data: remindersRes } = useApi<{ reminders: Reminder[] }>('tripReminders', { id: tripId });
  const { data: dealsRes } = useApi<{ deals: Deal[] }>('listDeals', { id: tripId });
  const { data: docsRes } = useApi<{ documents: DocRow[] }>('listDocuments', { id: tripId });
  const { data: finances } = useApi<Finances>('tripFinances', { id: tripId });
  const { data: settlement } = useApi<Settlement>('settlement', { id: tripId });

  const deleteTrip = useApiMutation<{ ok: boolean }>('deleteTrip', { invalidates: ['tripList'] });
  const updateTrip = useApiMutation<unknown>('updateTrip', { invalidates: ['getTrip', 'tripList'] });

  const onDelete = async () => {
    if (!confirm('Delete this trip and everything in it? This cannot be undone.')) return;
    try {
      await deleteTrip.mutate({ id: tripId });
      navigate('/');
    } catch {
      /* surfaced below */
    }
  };

  const currency = finances?.homeCurrency ?? 'USD';
  const travelers = travelersRes?.travelers ?? [];

  // Next up — 3 nearest scheduled items.
  const destName = new Map((trip?.destinations ?? []).map((d) => [d.id, d.name]));
  const allItems = (trip?.destinations ?? []).flatMap((d) => d.items ?? []);
  const nextUp = allItems
    .filter((i) => i.day)
    .sort((a, b) => (a.day + (a.startTime ?? '')).localeCompare(b.day + (b.startTime ?? '')))
    .slice(0, 3);

  // Needs attention — merged feed.
  const urgentReminders = (remindersRes?.reminders ?? []).filter(
    (r) => r.urgency === 'soon' || r.urgency === 'overdue',
  );
  const activeDeals = (dealsRes?.deals ?? []).filter(
    (d) => d.status !== 'taken' && d.status !== 'expired',
  );
  const pendingDocs = (docsRes?.documents ?? []).filter(
    (d) => d.status === 'analyzing' || d.status === 'error',
  );
  const transfers = settlement?.transfers ?? [];
  const attentionCount =
    urgentReminders.length + activeDeals.length + pendingDocs.length + transfers.length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="overview" />

      {isLoading && !trip ? (
        <SkeletonList count={3} lines={4} />
      ) : error || !trip ? (
        <ErrorState message="Failed to load trip." onRetry={refetch} />
      ) : (
        <>
          {/* Header card */}
          <section className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{trip.title}</h1>
                  <select
                    value={trip.status}
                    onChange={(e) => updateTrip.mutate({ id: tripId, status: e.target.value })}
                    disabled={updateTrip.isPending}
                    title="Trip status"
                    aria-label="Trip status"
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-xs capitalize text-muted-foreground disabled:opacity-50"
                  >
                    {['planning', 'booked', 'complete'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {trip.startDate || trip.endDate ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                    <span className="text-foreground">· {countdown(trip.startDate, trip.status)}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{countdown(trip.startDate, trip.status)}</p>
                )}
                {trip.brief ? <p className="text-sm text-muted-foreground">{trip.brief}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Avatars travelers={travelers} />
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleteTrip.isPending}
                  title="Delete trip"
                  aria-label="Delete trip"
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <BudgetStrip tripId={tripId} currency={currency} />
          </section>

          <RunStrip tripId={tripId} />

          {/* Needs attention — the single most valuable screen. */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Needs attention {attentionCount > 0 ? `(${attentionCount})` : ''}
            </h2>
            {attentionCount === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                All clear — nothing needs your attention right now.
              </div>
            ) : (
              <div className="space-y-2">
                {urgentReminders.map((r) => (
                  <Link
                    key={r.id}
                    href={`/trips/${tripId}/reminders`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <BellIcon className="h-4 w-4 text-warning" />
                      Book {r.title}
                      {r.bookByDate ? ` by ${formatDate(r.bookByDate)}` : ''}
                    </span>
                    <span className={`text-xs ${r.urgency === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {r.urgency === 'overdue' ? 'overdue' : r.daysLeft != null ? `${r.daysLeft}d left` : ''}
                    </span>
                  </Link>
                ))}
                {activeDeals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/trips/${tripId}/deals`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <TagIcon className="h-4 w-4 text-success" />
                      {d.title}
                    </span>
                    {d.estimatedSavings > 0 ? (
                      <span className="text-xs text-success">save {formatMoney(d.estimatedSavings, d.currency)}</span>
                    ) : null}
                  </Link>
                ))}
                {pendingDocs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/trips/${tripId}/documents`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                      {d.filename || 'Document'}
                    </span>
                    <span className={`text-xs ${d.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {d.status}
                    </span>
                  </Link>
                ))}
                {transfers.length > 0 ? (
                  <Link
                    href={`/trips/${tripId}/settlement`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <ScaleIcon className="h-4 w-4 text-muted-foreground" />
                      {transfers.length} payment{transfers.length === 1 ? '' : 's'} to settle
                    </span>
                    <span className="text-xs text-muted-foreground">Open settlement</span>
                  </Link>
                ) : null}
              </div>
            )}
          </section>

          {/* Next up */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Next up</h2>
            {trip.destinations.length === 0 ? (
              <EmptyState
                icon={MapPinIcon}
                title="Nothing planned yet"
                hint="Let the concierge draft an itinerary, or add stops on the timeline."
                actionLabel="Start planning"
                actionHref={`/trips/${tripId}/plan`}
              />
            ) : nextUp.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                No scheduled items yet.
              </div>
            ) : (
              <div className="space-y-2">
                {nextUp.map((it) => {
                  const s = kindStyle(it.kind);
                  return (
                    <Link
                      key={it.id}
                      href={`/trips/${tripId}/timeline`}
                      className="flex items-center gap-3 rounded-lg border border-l-4 border-border bg-card p-3 hover:border-primary"
                      style={{ borderLeftColor: s.colorVar }}
                    >
                      <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {formatDate(it.day)}
                        {it.startTime ? ` ${it.startTime}` : ''}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{destName.get(it.destinationId)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Money at a glance */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Money at a glance</h2>
            {finances ? (
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <FinanceBar
                  label="Booked + spent"
                  value={finances.booked + finances.spent}
                  max={Math.max(finances.budget, finances.booked + finances.spent, 1)}
                  currency={currency}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Remaining{' '}
                    <span className={finances.remaining < 0 ? 'font-medium text-destructive' : 'font-medium text-foreground'}>
                      {formatMoney(finances.remaining, currency)}
                    </span>
                  </span>
                  <Link href={`/trips/${tripId}/finances`} className="text-primary hover:underline">
                    Full finances →
                  </Link>
                </div>
              </div>
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </section>
        </>
      )}

      <CopilotDock tripId={tripId} tripTitle={trip?.title} />
    </main>
  );
}

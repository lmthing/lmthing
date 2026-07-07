import React from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { formatMoney } from '../../../components/format';
import { ScaleIcon, CheckIcon, ChevronRightIcon } from '../../../components/icons';

interface Balance {
  travelerId: string;
  name: string;
  paid: number;
  owes: number;
  net: number;
}
interface Transfer {
  fromTravelerId: string;
  fromName: string;
  toTravelerId: string;
  toName: string;
  amount: number;
}
interface SettlementData {
  balances: Balance[];
  transfers: Transfer[];
  currency: string;
  settledShares: number;
  totalShares: number;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--success)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * clamped) / 100}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        style={{ fill: 'var(--foreground)', fontSize: '15px', fontWeight: 700 }}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

export default function TripSettlement({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { data, isLoading, error, refetch } = useApi<SettlementData>('settlement', { id: tripId });

  const settle = useApiMutation<{ settled: number }>('settleBetween', {
    invalidates: ['settlement', 'tripFinances'],
  });

  const balances = data?.balances ?? [];
  const transfers = data?.transfers ?? [];
  const currency = data?.currency ?? 'USD';
  const total = data?.totalShares ?? 0;
  const settled = data?.settledShares ?? 0;
  const pct = total > 0 ? (settled / total) * 100 : transfers.length === 0 ? 100 : 0;

  const onMarkPaid = (t: Transfer) =>
    settle.mutate({ id: tripId, fromTravelerId: t.fromTravelerId, toTravelerId: t.toTravelerId });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="settlement" />
      <h1 className="text-2xl font-bold text-foreground">Settlement</h1>

      {isLoading && !data ? (
        <SkeletonList count={3} lines={2} />
      ) : error ? (
        <ErrorState message="Failed to load settlement." onRetry={refetch} />
      ) : balances.length === 0 ? (
        <EmptyState
          icon={ScaleIcon}
          title="Nothing to settle yet"
          hint="Add travelers and expenses, and the treasurer will split them into shares to settle."
          actionLabel="Add an expense"
          actionHref={`/trips/${tripId}/expenses`}
        />
      ) : (
        <>
          {/* Progress + net balance chips */}
          <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
            <ProgressRing pct={pct} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `${settled} of ${total} shares settled` : 'No shares to settle'}
              </p>
              <div className="flex flex-wrap gap-2">
                {balances.map((b) => (
                  <span
                    key={b.travelerId}
                    className={
                      'rounded-full border px-2.5 py-0.5 text-xs ' +
                      (Math.abs(b.net) < 0.005
                        ? 'border-border text-muted-foreground'
                        : b.net > 0
                          ? 'border-success text-success'
                          : 'border-destructive text-destructive')
                    }
                  >
                    {b.name}:{' '}
                    {Math.abs(b.net) < 0.005
                      ? 'settled'
                      : b.net > 0
                        ? `owed ${formatMoney(b.net, currency)}`
                        : `owes ${formatMoney(Math.abs(b.net), currency)}`}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Who pays whom */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Who pays whom</h2>
            {settle.error ? <ErrorState message="Could not mark that payment settled." /> : null}
            {transfers.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-success bg-card p-4 text-sm text-success">
                <CheckIcon className="h-4 w-4" />
                Everyone is settled up.
              </div>
            ) : (
              <div className="space-y-2">
                {transfers.map((t, i) => (
                  <div
                    key={`${t.fromTravelerId}-${t.toTravelerId}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <p className="flex items-center gap-2 text-foreground">
                      <span className="font-medium">{t.fromName}</span>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t.toName}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{formatMoney(t.amount, currency)}</span>
                      <button
                        type="button"
                        onClick={() => onMarkPaid(t)}
                        disabled={settle.isPending}
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                        Mark paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

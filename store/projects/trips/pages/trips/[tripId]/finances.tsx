import React from 'react';
import { useApi } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { FinanceBar } from '../../../components/FinanceBar';
import { Spinner } from '../../../components/Spinner';
import { formatMoney } from '../../../components/format';

interface CategoryTotal {
  category: string;
  amount: number;
}

interface TravelerTotal {
  travelerId: string;
  name: string;
  paid: number;
}

interface Finances {
  homeCurrency: string;
  budget: number;
  booked: number;
  spent: number;
  estimatedPlanned: number;
  remaining: number;
  byCategory: CategoryTotal[];
  byTraveler: TravelerTotal[];
}

export default function TripFinances({ params }: { params: { tripId: string } }) {
  const { tripId } = params;

  const { data, isLoading, error } = useApi<Finances>('tripFinances', { id: tripId });

  const currency = data?.homeCurrency ?? 'USD';
  const budget = data?.budget ?? 0;
  const booked = data?.booked ?? 0;
  const spent = data?.spent ?? 0;
  const estimatedPlanned = data?.estimatedPlanned ?? 0;
  const remaining = data?.remaining ?? 0;
  const byCategory = data?.byCategory ?? [];
  const byTraveler = data?.byTraveler ?? [];
  const committed = booked + spent;
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.amount));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="finances" />

      <h1 className="text-2xl font-bold text-foreground">Finances</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load finances.
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-0.5">
                <p className="text-xs uppercase text-muted-foreground">Budget</p>
                <p className="font-medium text-foreground">{formatMoney(budget, currency)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase text-muted-foreground">Booked</p>
                <p className="font-medium text-foreground">{formatMoney(booked, currency)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase text-muted-foreground">Spent</p>
                <p className="font-medium text-foreground">{formatMoney(spent, currency)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase text-muted-foreground">Remaining</p>
                <p className={`font-medium ${remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatMoney(remaining, currency)}
                </p>
              </div>
            </div>
            <FinanceBar label="Booked + spent" value={committed} max={Math.max(budget, committed, 1)} currency={currency} />
            <p className="text-sm text-muted-foreground">
              Estimated planned (not yet booked): {formatMoney(estimatedPlanned, currency)}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">By category</h2>
            {byCategory.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                No expenses recorded yet.
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                {byCategory.map((c) => (
                  <FinanceBar key={c.category} label={c.category} value={c.amount} max={maxCategory} currency={currency} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Paid by traveler</h2>
            {byTraveler.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                No travelers yet.
              </div>
            ) : (
              <div className="space-y-2">
                {byTraveler.map((t) => (
                  <div
                    key={t.travelerId}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
                  >
                    <p className="font-medium text-foreground">{t.name}</p>
                    <span className="text-sm text-muted-foreground">
                      {formatMoney(t.paid, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

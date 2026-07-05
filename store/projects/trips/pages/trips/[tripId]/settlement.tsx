import React from 'react';
import { useApi } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { SettlementRow } from '../../../components/SettlementRow';
import { Spinner } from '../../../components/Spinner';

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

export default function TripSettlement({ params }: { params: { tripId: string } }) {
  const { tripId } = params;

  const { data, isLoading, error } = useApi<{
    balances: Balance[];
    transfers: Transfer[];
    currency: string;
  }>('settlement', { id: tripId });

  const balances = data?.balances ?? [];
  const transfers = data?.transfers ?? [];
  const currency = data?.currency ?? 'USD';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="settlement" />

      <h1 className="text-2xl font-bold text-foreground">Settlement</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load settlement.
        </div>
      ) : null}

      {!isLoading && !error && balances.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No travelers yet. Add expenses and travelers to compute a settlement.
        </div>
      ) : null}

      {balances.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Balances</h2>
          <div className="space-y-2">
            {balances.map((b) => (
              <div
                key={b.travelerId}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
              >
                <p className="font-medium text-foreground">{b.name}</p>
                <span className={`text-sm font-medium ${b.net < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {b.net >= 0
                    ? `owed ${b.net.toFixed(2)} ${currency}`
                    : `owes ${Math.abs(b.net).toFixed(2)} ${currency}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Transfers</h2>

        {!isLoading && !error && transfers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Everyone is settled up.
          </div>
        ) : null}

        <div className="space-y-2">
          {transfers.map((t, i) => (
            <SettlementRow
              key={`${t.fromTravelerId}-${t.toTravelerId}-${i}`}
              fromName={t.fromName}
              toName={t.toName}
              amount={t.amount}
              currency={currency}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

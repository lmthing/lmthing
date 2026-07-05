import React from 'react';
import { useApi, Chat } from '@app/runtime';
import { AisleGroup, type AisleLine } from '../../components/AisleGroup';
import { Spinner } from '../../components/Spinner';

interface Aisle {
  aisle: string;
  lines: AisleLine[];
}

interface ShoppingTripOutput {
  aisles: Aisle[];
  estimatedCost: number;
}

export default function Trip({ params }: { params: { planId: string } }) {
  const { planId } = params;
  const { data, isLoading, error } = useApi<ShoppingTripOutput>('getShoppingTrip', { id: planId });

  if (isLoading) return <Spinner />;

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load shopping trip.
        </div>
      </main>
    );
  }

  const aisles = data.aisles ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Shopping trip</h1>
        <span className="text-sm text-muted-foreground">
          Est. total: <span className="font-medium text-foreground">${data.estimatedCost.toFixed(2)}</span>
        </span>
      </div>

      {aisles.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Nothing left to buy.
        </div>
      ) : null}

      <div className="space-y-3">
        {aisles.map((a) => (
          <AisleGroup key={a.aisle} aisle={a.aisle} lines={a.lines} />
        ))}
      </div>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Optimize this trip</h2>
        <Chat agent="sourcing/optimizer" />
      </section>
    </main>
  );
}

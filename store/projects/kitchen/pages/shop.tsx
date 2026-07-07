import React, { useState } from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation, apiCall, Chat } from '@app/runtime';
import { ShoppingRow, type ShoppingRowItem } from '../components/ShoppingRow';
import { AisleGroup, type AisleLine } from '../components/AisleGroup';
import { Spinner } from '../components/Spinner';
import { Tabs } from '../components/Tabs';
import { ClipboardList, ShoppingCart, Repeat, CalendarPlus } from '../components/icons';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null })[] };

interface TripAisle {
  aisle: string;
  lines: AisleLine[];
}
interface ShoppingTripOutput {
  aisles: TripAisle[];
  estimatedCost: number;
}
interface Substitution {
  id: string;
  ingredientName: string;
  substituteName: string;
  ratio: number;
  reason?: string;
  note?: string;
  unit: string;
}
interface OrderOutput {
  configured: boolean;
  provider: string | null;
  checkoutUrl: string | null;
  estimatedCost: number;
  note: string;
}

const TABS = [
  { id: 'list', label: 'List', Icon: ClipboardList },
  { id: 'trip', label: 'Trip', Icon: ShoppingCart },
  { id: 'swaps', label: 'Swaps', Icon: Repeat },
];

export default function Shop() {
  const [tab, setTab] = useState('list');
  const [order, setOrder] = useState<OrderOutput | null>(null);
  const [ordering, setOrdering] = useState(false);

  const { data: planData } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});
  const planId = planData?.plan?.id;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Shop</h1>
        {planId ? (
          <button
            type="button"
            onClick={async () => {
              try {
                const res = (await apiCall('planCalendar', { id: planId })) as {
                  ics: string;
                  filename: string;
                };
                const blob = new Blob([res.ics], { type: 'text/calendar' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.filename;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Add week to calendar
          </button>
        ) : null}
      </div>

      {!planId ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No current plan. Plan your week first.
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'list' ? <ListView planId={planId} order={order} setOrder={setOrder} ordering={ordering} setOrdering={setOrdering} /> : null}
          {tab === 'trip' ? <TripView planId={planId} /> : null}
          {tab === 'swaps' ? <SwapsView /> : null}
        </>
      )}
    </main>
  );
}

function ListView({
  planId,
  order,
  setOrder,
  ordering,
  setOrdering,
}: {
  planId: string;
  order: OrderOutput | null;
  setOrder: (o: OrderOutput | null) => void;
  ordering: boolean;
  setOrdering: (b: boolean) => void;
}) {
  const { data: shopping, isLoading, error } = useApi<{ items: ShoppingRowItem[] }>('shoppingList', {
    id: planId,
  });
  const toggleBought = useApiMutation<{ ok: boolean }>('toggleBought', {
    invalidates: ['shoppingList', 'listPantry', 'kitchenStats', 'planCoverage'],
  });

  const items = shopping?.items ?? [];
  const boughtCount = items.filter((i) => i.bought).length;
  const pct = items.length > 0 ? Math.round((boughtCount / items.length) * 100) : 0;
  // Re-sort bought items to the bottom for one-thumb shopping in-aisle.
  const sorted = [...items].sort((a, b) => Number(a.bought) - Number(b.bought));

  const placeOrder = async () => {
    setOrdering(true);
    try {
      const res = (await apiCall('orderGroceries', { id: planId })) as OrderOutput;
      setOrder(res);
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank', 'noopener');
    } catch {
      /* ignore */
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {boughtCount} of {items.length} bought
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load shopping list.
        </div>
      ) : null}
      {!isLoading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Nothing to buy — your pantry covers this week.
        </div>
      ) : null}

      <div className="space-y-2">
        {sorted.map((item) => (
          <ShoppingRow
            key={item.id ?? item.ingredient}
            item={item}
            pending={toggleBought.isPending}
            onToggle={(bought) => toggleBought.mutate({ id: item.id, bought })}
          />
        ))}
      </div>

      {items.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={placeOrder}
            disabled={ordering}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            {ordering ? 'Building order…' : 'Order groceries'}
          </button>
          {order ? (
            <p className="text-xs text-muted-foreground">
              {order.note} Estimated total:{' '}
              <span className="font-medium text-foreground">${order.estimatedCost.toFixed(2)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TripView({ planId }: { planId: string }) {
  const { data, isLoading, error } = useApi<ShoppingTripOutput>('getShoppingTrip', { id: planId });

  return (
    <div className="space-y-4">
      {isLoading ? <Spinner /> : null}
      {error || !data ? (
        !isLoading ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load the shopping trip.
          </div>
        ) : null
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Aisle-grouped route</span>
            <span className="text-sm text-muted-foreground">
              Est. total:{' '}
              <span className="font-medium text-foreground">${data.estimatedCost.toFixed(2)}</span>
            </span>
          </div>
          {(data.aisles ?? []).length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              Nothing left to buy.
            </div>
          ) : (
            <div className="space-y-3">
              {data.aisles.map((a) => (
                <AisleGroup key={a.aisle} aisle={a.aisle} lines={a.lines} />
              ))}
            </div>
          )}
          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Optimize this trip</h2>
            <Chat agent="sourcing/optimizer" />
          </section>
        </>
      )}
    </div>
  );
}

function SwapsView() {
  const { data: subs, isLoading, error } = useApi<Substitution[]>('listAllSubstitutions', {});
  const list = subs ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? <Spinner /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load substitutions.
        </div>
      ) : null}
      {!isLoading && !error && list.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No substitutions yet. The nightly optimizer suggests swaps for out-of-stock, expiring, or
          costly ingredients.
        </div>
      ) : null}

      {list.map((s) => (
        <div key={s.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {s.ingredientName} → {s.substituteName}
            </p>
            {s.reason ? (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {s.reason}
              </span>
            ) : null}
          </div>
          {s.note ? <p className="mt-1 text-sm text-muted-foreground">{s.note}</p> : null}
          {s.ratio && s.ratio !== 1 ? (
            <p className="mt-1 text-xs text-muted-foreground">Use {s.ratio}× per unit.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

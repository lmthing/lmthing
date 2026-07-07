import React from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { ShoppingRow, type ShoppingRowItem } from '../components/ShoppingRow';
import { Spinner } from '../components/Spinner';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null })[] };

export default function Shopping() {
  const { data: planData } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});
  const planId = planData?.plan?.id;

  const {
    data: shopping,
    isLoading,
    error,
  } = useApi<{ items: ShoppingRowItem[] }>(
    'shoppingList',
    { id: planId },
    { enabled: !!planId },
  );

  const toggleBought = useApiMutation<{ ok: boolean }>('toggleBought', {
    invalidates: ['shoppingList', 'listPantry', 'kitchenStats'],
  });

  const items = shopping?.items ?? [];
  const boughtCount = items.filter((i) => i.bought).length;
  const pct = items.length > 0 ? Math.round((boughtCount / items.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Shopping list</h1>
        {planId ? (
          <Link
            href={`/trip/${planId}`}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Organize by aisle →
          </Link>
        ) : null}
      </div>

      {planId && items.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {boughtCount} of {items.length} bought
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {!planId ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No current plan. Plan your week first.
        </div>
      ) : null}

      {planId && isLoading ? <Spinner /> : null}

      {planId && error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load shopping list.
        </div>
      ) : null}

      {planId && !isLoading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Nothing to buy — your pantry covers this week.
        </div>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <ShoppingRow
            key={item.id ?? item.ingredient}
            item={item}
            pending={toggleBought.isPending}
            onToggle={(bought) => toggleBought.mutate({ id: item.id, bought })}
          />
        ))}
      </div>
    </main>
  );
}

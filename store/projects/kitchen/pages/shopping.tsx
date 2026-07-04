import React from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
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

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Shopping list</h1>

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

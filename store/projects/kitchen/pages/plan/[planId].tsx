import React from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { WeekGrid } from '../../components/WeekGrid';
import { Spinner } from '../../components/Spinner';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null })[] };

export default function PlanDetail({ params }: { params: { planId: string } }) {
  const { planId } = params;
  const { data, isLoading, error } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});

  const removeMeal = useApiMutation<{ ok: boolean }>('removeMeal', {
    invalidates: ['currentPlan'],
  });

  const plan = data?.plan ?? null;

  if (isLoading) return <Spinner />;

  if (error || !plan) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          No plan found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">
          Plan {planId === plan.id ? `· week of ${plan.weekStart}` : `· ${planId}`}
        </h1>
        <Link href="/shopping" className="text-sm text-primary hover:underline">
          View shopping list →
        </Link>
      </div>

      <WeekGrid meals={plan.meals} onRemoveMeal={(id) => removeMeal.mutate({ id })} />
    </main>
  );
}

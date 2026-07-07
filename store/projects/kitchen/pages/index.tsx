import React, { useEffect } from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { StatsStrip, type Stats } from '../components/StatsStrip';
import { WeekGrid } from '../components/WeekGrid';
import { Spinner } from '../components/Spinner';
import { SuggestionCard, type SuggestionWithRefs } from '../components/SuggestionCard';
import { formatDay } from '../components/format';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null })[] };

export default function ThisWeek() {
  const { data: stats } = useApi<Stats>('kitchenStats', {});
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});

  const { data: suggestions } = useApi<SuggestionWithRefs[]>('listSuggestions', {});

  const dismissSuggestion = useApiMutation<{ ok: boolean }>('dismissSuggestion', {
    invalidates: ['listSuggestions'],
  });

  const generatePlan = useApiMutation<{ planId: string; status: string }>('generatePlan', {
    invalidates: ['currentPlan', 'kitchenStats'],
  });

  const removeMeal = useApiMutation<{ ok: boolean }>('removeMeal', {
    invalidates: ['currentPlan', 'kitchenStats'],
  });

  const rateMeal = useApiMutation<PlanMeal>('rateMeal', {
    invalidates: ['currentPlan'],
  });

  const markCooked = useApiMutation<PlanMeal>('markCooked', {
    invalidates: ['currentPlan'],
  });

  const plan = data?.plan ?? null;
  const topSuggestions = (suggestions ?? []).slice(0, 3);

  useEffect(() => {
    if (plan?.status !== 'planning') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [plan?.status, refetch]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      {topSuggestions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Suggestions</h2>
          <div className="space-y-2">
            {topSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onDismiss={(id) => dismissSuggestion.mutate({ id })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {stats ? <StatsStrip stats={stats} /> : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load this week&apos;s plan.
        </div>
      ) : null}

      {!isLoading && !error && !plan ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">No plan yet for this week.</p>
          <button
            type="button"
            disabled={generatePlan.isPending}
            onClick={() => generatePlan.mutate({})}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {generatePlan.isPending ? 'Planning…' : 'Plan this week'}
          </button>
          {generatePlan.error ? (
            <p className="text-sm text-destructive">
              {(generatePlan.error as { message?: string })?.message ?? 'Failed to plan this week.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">
              Week of {formatDay(plan.weekStart)}
            </h1>
            <span
              className={
                plan.status === 'ready'
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground'
              }
            >
              <span
                className={
                  plan.status === 'planning'
                    ? 'inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground'
                    : 'inline-block h-1.5 w-1.5 rounded-full bg-primary'
                }
              />
              {plan.status === 'ready' ? 'Ready' : plan.status === 'planning' ? 'Planning…' : plan.status}
            </span>
          </div>
          <WeekGrid
            meals={plan.meals}
            onRemoveMeal={(id) => removeMeal.mutate({ id })}
            onRateMeal={(id, rating) => rateMeal.mutate({ id, rating })}
            onCookMeal={(id) => markCooked.mutate({ id })}
          />
        </div>
      ) : null}
    </main>
  );
}

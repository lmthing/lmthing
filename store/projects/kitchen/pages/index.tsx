import React, { useEffect, useState } from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { StatsStrip, type Stats } from '../components/StatsStrip';
import { WeekGrid } from '../components/WeekGrid';
import { WeekGridSkeleton } from '../components/Skeleton';
import { SuggestionCard, type SuggestionWithRefs } from '../components/SuggestionCard';
import { TonightCard, type TonightMeal } from '../components/TonightCard';
import { CoverageRibbon } from '../components/CoverageRibbon';
import { PlanProgress } from '../components/PlanProgress';
import { ImprovisePanel } from '../components/ImprovisePanel';
import { OnboardingCard } from '../components/OnboardingCard';
import { RecipePicker } from '../components/RecipePicker';
import { openConcierge } from '../components/ConciergeDock';
import { RotateCw } from '../components/icons';
import { formatDay } from '../components/format';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null; rationale?: string })[] };

interface DayNutrition {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
interface PlanNutritionOutput {
  days: DayNutrition[];
}
interface Coverage {
  cookablePct: number;
  itemsToBuy: number;
  mealsPlanned: number;
  mealsTarget: number;
  status: string;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pick the most-relevant dinner: today's, else the next upcoming, else the first. */
function pickTonight(meals: PlanWithMeals['meals']): TonightMeal | null {
  const dinners = meals.filter((m) => m.meal === 'dinner' && m.recipe);
  if (dinners.length === 0) return null;
  const today = todayIso();
  const exact = dinners.find((m) => m.day === today);
  if (exact) return exact;
  const upcoming = dinners.filter((m) => m.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  return upcoming[0] ?? dinners.sort((a, b) => a.day.localeCompare(b.day))[0];
}

export default function ThisWeek() {
  const { data: stats } = useApi<Stats>('kitchenStats', {});
  const { data, isLoading, error, refetch } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});
  const { data: suggestions } = useApi<SuggestionWithRefs[]>('listSuggestions', {});

  const plan = data?.plan ?? null;
  const planId = plan?.id;

  const { data: coverage } = useApi<Coverage>('planCoverage', { id: planId }, { enabled: !!planId });
  const { data: planNutrition } = useApi<PlanNutritionOutput>(
    'getPlanNutrition',
    { id: planId },
    { enabled: !!planId },
  );

  const dismissSuggestion = useApiMutation<{ ok: boolean }>('dismissSuggestion', {
    invalidates: ['listSuggestions'],
  });
  const generatePlan = useApiMutation<{ planId: string; status: string }>('generatePlan', {
    invalidates: ['currentPlan', 'kitchenStats', 'planCoverage'],
  });
  const removeMeal = useApiMutation<{ ok: boolean }>('removeMeal', {
    invalidates: ['currentPlan', 'kitchenStats', 'planCoverage'],
  });
  const rateMeal = useApiMutation<PlanMeal>('rateMeal', { invalidates: ['currentPlan'] });
  const markCooked = useApiMutation<PlanMeal>('markCooked', { invalidates: ['currentPlan'] });
  const addMeal = useApiMutation<{ id: string }>('addMeal', {
    invalidates: ['currentPlan', 'kitchenStats', 'planCoverage'],
  });
  const updateMeal = useApiMutation<PlanMeal>('updateMeal', { invalidates: ['currentPlan'] });
  const seed = useApiMutation<{ seeded: number }>('seedStarterRecipes', {
    invalidates: ['listRecipes', 'kitchenStats'],
  });

  const [picker, setPicker] = useState<{ day: string; slot: string } | null>(null);
  // Optimistic "cooked tonight" so the hero responds instantly and reconciles on refetch.
  const [cookedOptimistic, setCookedOptimistic] = useState<Record<string, boolean>>({});

  const topSuggestions = (suggestions ?? []).slice(0, 3);
  const tonight = plan ? pickTonight(plan.meals) : null;
  const tonightMacros =
    tonight && planNutrition ? planNutrition.days.find((d) => d.day === tonight.day) ?? null : null;
  const dinnerCount = plan ? plan.meals.filter((m) => m.meal === 'dinner').length : 0;
  const noRecipes = (stats?.recipes ?? 0) === 0;

  useEffect(() => {
    if (plan?.status !== 'planning') return;
    const interval = setInterval(() => refetch(), 4000);
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

      {tonight ? (
        <TonightCard
          meal={tonight}
          macros={tonightMacros}
          cooked={Boolean(tonight.cookedAt) || Boolean(cookedOptimistic[tonight.id])}
          onCook={() => {
            setCookedOptimistic((m) => ({ ...m, [tonight.id]: true }));
            markCooked.mutate({ id: tonight.id });
          }}
          onRate={(rating) => rateMeal.mutate({ id: tonight.id, rating })}
        />
      ) : null}

      {coverage && plan ? (
        <CoverageRibbon cookablePct={coverage.cookablePct} itemsToBuy={coverage.itemsToBuy} />
      ) : null}

      {stats ? <StatsStrip stats={stats} /> : null}

      {plan ? <ImprovisePanel planId={planId} /> : null}

      {isLoading ? <WeekGridSkeleton /> : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive">
          <span>Couldn&apos;t load this week&apos;s plan.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1 text-destructive hover:bg-destructive/10"
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && !plan ? (
        noRecipes ? (
          <OnboardingCard onSeed={() => seed.mutate({})} seeding={seed.isPending} onAskChef={openConcierge} />
        ) : (
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
        )
      ) : null}

      {plan ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground">Week of {formatDay(plan.weekStart)}</h1>
            <div className="min-w-[12rem] flex-1 sm:max-w-xs">
              <PlanProgress planned={dinnerCount} target={coverage?.mealsTarget ?? 7} status={plan.status} />
            </div>
          </div>
          <WeekGrid
            meals={plan.meals}
            onRemoveMeal={(id) => removeMeal.mutate({ id })}
            onRateMeal={(id, rating) => rateMeal.mutate({ id, rating })}
            onCookMeal={(id) => markCooked.mutate({ id })}
            onAddMeal={(day, slot) => setPicker({ day, slot })}
            onMoveMeal={(id, day, slot) => updateMeal.mutate({ id, day, meal: slot })}
          />
        </div>
      ) : null}

      <RecipePicker
        open={picker !== null}
        title={picker ? `Add ${picker.slot} · ${formatDay(picker.day)}` : 'Add a meal'}
        onClose={() => setPicker(null)}
        onPick={(recipeId) => {
          if (picker && planId) {
            addMeal.mutate({ planId, recipeId, day: picker.day, meal: picker.slot });
          }
          setPicker(null);
        }}
      />
    </main>
  );
}

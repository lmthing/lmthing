import React from 'react';
import type { MealPlan, PlanMeal, Recipe, Ingredient } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { MacroBar } from '../components/MacroBar';
import { MacroTriplet } from '../components/MacroTriplet';
import { ExpiringRow } from '../components/ExpiringRow';
import { SuggestionCard, type SuggestionWithRefs } from '../components/SuggestionCard';
import { CoverageRibbon } from '../components/CoverageRibbon';
import { Spinner } from '../components/Spinner';
import { formatDay } from '../components/format';

type PlanWithMeals = MealPlan & { meals: (PlanMeal & { recipe: Recipe | null })[] };

interface DayNutrition {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
interface PlanNutritionOutput {
  days: DayNutrition[];
  targets: { calories: number; protein: number };
  adherence: number;
}
interface NutritionStatsOutput {
  weekCalories: number;
  weekProtein: number;
  avgPerDay: { calories: number; protein: number };
  target: { calories: number; protein: number };
  onTrack: boolean;
}
interface Coverage {
  cookablePct: number;
  itemsToBuy: number;
}

export default function Insights() {
  const { data: planData } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});
  const planId = planData?.plan?.id;

  const { data: coverage } = useApi<Coverage>('planCoverage', { id: planId }, { enabled: !!planId });
  const { data: stats, isLoading: loadingStats } = useApi<NutritionStatsOutput>('nutritionStats', {});
  const { data: planNutrition, isLoading: loadingPlan } = useApi<PlanNutritionOutput>(
    'getPlanNutrition',
    { id: planId },
    { enabled: !!planId },
  );

  const { data: expiring, isLoading: loadingExpiring } = useApi<Ingredient[]>('listExpiring', {
    withinDays: 7,
  });
  const { data: suggestions } = useApi<SuggestionWithRefs[]>('listSuggestions', {});
  const dismissSuggestion = useApiMutation<{ ok: boolean }>('dismissSuggestion', {
    invalidates: ['listSuggestions'],
  });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Insights</h1>

      {coverage && planId ? (
        <CoverageRibbon cookablePct={coverage.cookablePct} itemsToBuy={coverage.itemsToBuy} />
      ) : null}

      {/* ── Nutrition ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">This week&apos;s nutrition</h2>

        {!planId ? (
          <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">Plan a week to see your nutrition.</p>
            <Link href="/" className="text-sm text-primary hover:underline">
              Go to Cook →
            </Link>
          </div>
        ) : (
          <>
            {loadingStats ? <Spinner /> : null}
            {stats ? (
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {Math.round(stats.weekCalories)} kcal · {Math.round(stats.weekProtein)}g protein this week
                  </span>
                  <span
                    className={
                      stats.onTrack
                        ? 'rounded-full border border-border px-2 py-0.5 text-xs text-primary'
                        : 'rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive'
                    }
                  >
                    {stats.onTrack ? 'On track' : 'Off track'}
                  </span>
                </div>
                <MacroBar label="Avg calories / day" value={stats.avgPerDay.calories} target={stats.target.calories} unit=" kcal" />
                <MacroBar label="Avg protein / day" value={stats.avgPerDay.protein} target={stats.target.protein} unit="g" />
              </div>
            ) : null}

            {loadingPlan ? <Spinner /> : null}
            {planNutrition ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Adherence: {Math.round(planNutrition.adherence * 100)}%
                </p>
                {(planNutrition.days ?? []).map((day) => (
                  <div key={day.day} className="space-y-2 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{formatDay(day.day)}</p>
                    </div>
                    <MacroTriplet
                      macros={{ calories: day.calories, protein: day.protein, carbs: day.carbs, fat: day.fat }}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ── Expiring ─────────────────────────────────────────── */}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Expiring soon</h2>
        {loadingExpiring ? <Spinner /> : null}
        {!loadingExpiring && (expiring ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Nothing expiring in the next week.
          </div>
        ) : null}
        <div className="space-y-2">
          {(expiring ?? []).map((ing) => (
            <ExpiringRow key={ing.id} ingredient={ing} />
          ))}
        </div>
      </section>

      {/* ── Suggestions ─────────────────────────────────────── */}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Suggestions</h2>
        {(suggestions ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No suggestions right now.
          </div>
        ) : null}
        <div className="space-y-2">
          {(suggestions ?? []).map((s) => (
            <SuggestionCard key={s.id} suggestion={s} onDismiss={(id) => dismissSuggestion.mutate({ id })} />
          ))}
        </div>
      </section>
    </main>
  );
}

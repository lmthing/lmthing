import React from 'react';
import type { MealPlan, PlanMeal, Recipe } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { MacroBar } from '../components/MacroBar';
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

export default function Nutrition() {
  const { data: planData } = useApi<{ plan: PlanWithMeals | null }>('currentPlan', {});
  const planId = planData?.plan?.id;

  const {
    data: planNutrition,
    isLoading: loadingPlan,
    error: planError,
  } = useApi<PlanNutritionOutput>('getPlanNutrition', { id: planId }, { enabled: !!planId });

  const { data: stats, isLoading: loadingStats } = useApi<NutritionStatsOutput>('nutritionStats', {});

  if (!planId) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-bold text-foreground">Nutrition</h1>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">Plan a week first.</p>
          <Link href="/" className="text-sm text-primary hover:underline">
            Go to This Week →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Nutrition</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">This week</h2>

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
            <MacroBar
              label="Avg calories / day"
              value={stats.avgPerDay.calories}
              target={stats.target.calories}
              unit=" kcal"
            />
            <MacroBar
              label="Avg protein / day"
              value={stats.avgPerDay.protein}
              target={stats.target.protein}
              unit="g"
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">By day</h2>

        {loadingPlan ? <Spinner /> : null}

        {planError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load plan nutrition.
          </div>
        ) : null}

        {planNutrition ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adherence: {Math.round(planNutrition.adherence * 100)}%
            </p>
            {(planNutrition.days ?? []).map((day) => (
              <div key={day.day} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">{formatDay(day.day)}</p>
                <MacroBar
                  label="Calories"
                  value={day.calories}
                  target={planNutrition.targets.calories}
                  unit=" kcal"
                />
                <MacroBar
                  label="Protein"
                  value={day.protein}
                  target={planNutrition.targets.protein}
                  unit="g"
                />
                <MacroBar label="Carbs" value={day.carbs} unit="g" />
                <MacroBar label="Fat" value={day.fat} unit="g" />
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

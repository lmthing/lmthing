type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

import { HttpError } from '@app/runtime';

export const name = 'getPlanNutrition';
export const description = "Break a meal plan's nutrition down by day and compare the daily average against household targets.";

export interface Input {
  id: string;
}

interface DayTotal {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Output {
  days: DayTotal[];
  targets: { calories: number; protein: number };
  adherence: number;
}

interface PlanMeal {
  id: string;
  planId: string;
  recipeId: string;
  day: string;
  servings: number;
}

interface MealPlan {
  id: string;
  meals: PlanMeal[];
}

interface MealNutrition {
  id: string;
  planMealId: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Settings {
  id: string;
  householdSize: number;
  calorieTarget: number;
  proteinTarget: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],
  })) as MealPlan[];

  const plan = rows[0];
  if (!plan) {
    throw new HttpError(404, 'plan not found');
  }

  const settingsRows = (await ctx.db.query('settings')) as Settings[];
  const settings = settingsRows[0];
  const householdSize = settings?.householdSize ?? 2;
  const targets = {
    calories: (settings?.calorieTarget ?? 2000) * householdSize,
    protein: (settings?.proteinTarget ?? 80) * householdSize,
  };

  const byDay = new Map<string, DayTotal>();

  for (const meal of plan.meals ?? []) {
    const nutritionRows = (await ctx.db.query('meal_nutrition', {
      where: { planMealId: meal.id },
    })) as MealNutrition[];
    const nutrition = nutritionRows[0];

    const day = meal.day ?? 'unknown';
    const entry = byDay.get(day) ?? { day, calories: 0, protein: 0, carbs: 0, fat: 0 };

    if (nutrition) {
      entry.calories += nutrition.calories ?? 0;
      entry.protein += nutrition.protein ?? 0;
      entry.carbs += nutrition.carbs ?? 0;
      entry.fat += nutrition.fat ?? 0;
    }

    byDay.set(day, entry);
  }

  const days = Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));

  const withinTarget = days.filter((d) => {
    if (targets.calories <= 0) return false;
    const ratio = d.calories / targets.calories;
    return ratio >= 0.75 && ratio <= 1.25;
  }).length;

  const adherence = days.length > 0 ? withinTarget / days.length : 0;

  return { days, targets, adherence };
}

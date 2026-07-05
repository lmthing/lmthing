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

export const name = 'nutritionStats';
export const description = "Summarize the current week's plan nutrition (weekly totals and daily average) against household targets.";

export interface Input {}

export interface Output {
  weekCalories: number;
  weekProtein: number;
  avgPerDay: { calories: number; protein: number };
  target: { calories: number; protein: number };
  onTrack: boolean;
}

interface MealPlan {
  id: string;
  weekStart: string;
}

interface PlanMeal {
  id: string;
  planId: string;
}

interface MealNutrition {
  id: string;
  planMealId: string;
  calories: number;
  protein: number;
}

interface Settings {
  id: string;
  householdSize: number;
  calorieTarget: number;
  proteinTarget: number;
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const settingsRows = (await ctx.db.query('settings')) as Settings[];
  const settings = settingsRows[0];
  const householdSize = settings?.householdSize ?? 2;
  const target = {
    calories: (settings?.calorieTarget ?? 2000) * householdSize,
    protein: (settings?.proteinTarget ?? 80) * householdSize,
  };

  const plans = (await ctx.db.query('meal_plans')) as MealPlan[];
  let currentPlan: MealPlan | null = null;
  for (const p of plans) {
    if (!currentPlan || (p.weekStart ?? '') > (currentPlan.weekStart ?? '')) {
      currentPlan = p;
    }
  }

  if (!currentPlan) {
    return {
      weekCalories: 0,
      weekProtein: 0,
      avgPerDay: { calories: 0, protein: 0 },
      target,
      onTrack: false,
    };
  }

  const meals = (await ctx.db.query('plan_meals', { where: { planId: currentPlan.id } })) as PlanMeal[];

  let weekCalories = 0;
  let weekProtein = 0;

  for (const meal of meals) {
    const nutritionRows = (await ctx.db.query('meal_nutrition', {
      where: { planMealId: meal.id },
    })) as MealNutrition[];
    const nutrition = nutritionRows[0];
    if (nutrition) {
      weekCalories += nutrition.calories ?? 0;
      weekProtein += nutrition.protein ?? 0;
    }
  }

  const avgPerDay = {
    calories: weekCalories / 7,
    protein: weekProtein / 7,
  };

  const onTrack =
    target.calories > 0 &&
    avgPerDay.calories / target.calories >= 0.75 &&
    avgPerDay.calories / target.calories <= 1.25;

  return { weekCalories, weekProtein, avgPerDay, target, onTrack };
}

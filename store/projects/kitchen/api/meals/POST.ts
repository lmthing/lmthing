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

export const name = 'addMeal';
export const description =
  'Slot a recipe into a plan on a given day/meal (e.g. "add to tonight"). Inserting the row fans out to the nutrition + shopping recompute hooks automatically.';

export interface Input {
  planId: string;
  recipeId: string;
  /** ISO calendar day (YYYY-MM-DD). Defaults to today. */
  day?: string;
  /** 'breakfast' | 'lunch' | 'dinner'. Defaults to 'dinner'. */
  meal?: string;
  servings?: number;
  /** short human reason this recipe was chosen for this slot, shown on hover. */
  rationale?: string;
}

export interface Output {
  id: string;
  planId: string;
  recipeId: string;
  day: string;
  meal: string;
  servings: number;
}

interface Recipe {
  id: string;
}
interface Settings {
  householdSize?: number;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  // Guard against dangling references — never slot a recipe or plan that doesn't exist.
  const recipe = (await ctx.db.query('recipes', { where: { id: input.recipeId } })) as Recipe[];
  if (!recipe[0]) throw new HttpError(404, 'recipe not found');
  const plan = (await ctx.db.query('meal_plans', { where: { id: input.planId } })) as Row[];
  if (!plan[0]) throw new HttpError(404, 'plan not found');

  const settings = (await ctx.db.query('settings')) as Settings[];
  const servings = input.servings ?? settings[0]?.householdSize ?? 2;

  const created = (await ctx.db.insert('plan_meals', {
    planId: input.planId,
    recipeId: input.recipeId,
    day: input.day ?? todayIso(),
    meal: input.meal ?? 'dinner',
    servings,
    ...(input.rationale ? { rationale: input.rationale } : {}),
  })) as Output;

  return created;
}

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

export const name = 'updateMeal';
export const description = "Update a plan meal slot's recipe, day, servings, or meal type.";

export interface Input {
  id: string;
  recipeId?: string;
  day?: string;
  servings?: number;
  meal?: string;
}

export interface PlanMeal {
  id: string;
  planId: string;
  recipeId: string;
  day: string;
  meal: string;
  servings: number;
}

export type Output = PlanMeal;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.recipeId !== undefined) set.recipeId = input.recipeId;
  if (input.day !== undefined) set.day = input.day;
  if (input.servings !== undefined) set.servings = input.servings;
  if (input.meal !== undefined) set.meal = input.meal;

  await ctx.db.update('plan_meals', {
    where: { id: input.id },
    set,
  });

  const rows = (await ctx.db.query('plan_meals', { where: { id: input.id } })) as PlanMeal[];
  const meal = rows[0];
  if (!meal) {
    throw new HttpError(404, 'meal not found');
  }

  return meal;
}

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

export const name = 'markCooked';
export const description = 'Mark a plan meal slot as cooked, stamping the cookedAt date.';

export interface Input {
  id: string;
}

export interface PlanMeal {
  id: string;
  planId: string;
  recipeId: string;
  day: string;
  meal: string;
  servings: number;
  rating: number | null;
  cookedAt: string | null;
}

export type Output = PlanMeal;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  await ctx.db.update('plan_meals', {
    where: { id: input.id },
    set: { cookedAt: new Date().toISOString() },
  });

  const rows = (await ctx.db.query('plan_meals', { where: { id: input.id } })) as PlanMeal[];
  const meal = rows[0];
  if (!meal) {
    throw new HttpError(404, 'meal not found');
  }

  return meal;
}

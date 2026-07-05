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

export const name = 'updatePantry';
export const description = "Update a pantry ingredient's on-hand quantity.";

export interface Input {
  id: string;
  quantity?: number;
  /** ISO date this stock goes off (waste-reduction: the /expiring page + use-it-up hook). */
  expiresAt?: string | null;
  /** rough price per `unit`, feeding the shopping-trip cost estimate. */
  costPerUnit?: number;
  /** restock hint: below this the planner treats the item as unavailable. */
  lowStockThreshold?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type Output = Ingredient;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  // Only set the fields the caller actually sent — a quantity-only "used the milk" PATCH must not
  // clobber expiresAt/costPerUnit, and an expiry-only PATCH must not reset the quantity.
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.quantity !== undefined) set.quantity = input.quantity;
  if (input.expiresAt !== undefined) set.expiresAt = input.expiresAt;
  if (input.costPerUnit !== undefined) set.costPerUnit = input.costPerUnit;
  if (input.lowStockThreshold !== undefined) set.lowStockThreshold = input.lowStockThreshold;
  await ctx.db.update('ingredients', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('ingredients', { where: { id: input.id } })) as Ingredient[];
  const ingredient = rows[0];
  if (!ingredient) {
    throw new HttpError(404, 'ingredient not found');
  }

  return ingredient;
}

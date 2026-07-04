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

export const name = 'toggleBought';
export const description = 'Mark a shopping list line as bought (or not); checking it off tops up the pantry quantity for that ingredient.';

export interface Input {
  id: string;
  bought: boolean;
}

export interface Output {
  ok: boolean;
}

interface ShoppingRow {
  id: string;
  planId: string;
  ingredientId: string;
  quantity: number;
  bought: boolean;
}

interface Ingredient {
  id: string;
  quantity: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('shopping_list', { where: { id: input.id } })) as ShoppingRow[];
  const row = rows[0];
  if (!row) {
    throw new HttpError(404, 'shopping list item not found');
  }

  await ctx.db.update('shopping_list', {
    where: { id: input.id },
    set: { bought: input.bought },
  });

  if (input.bought === true) {
    const ingredientRows = (await ctx.db.query('ingredients', {
      where: { id: row.ingredientId },
    })) as Ingredient[];
    const ingredient = ingredientRows[0];

    await ctx.db.update('ingredients', {
      where: { id: row.ingredientId },
      set: {
        quantity: (ingredient?.quantity ?? 0) + (row.quantity ?? 0),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return { ok: true };
}

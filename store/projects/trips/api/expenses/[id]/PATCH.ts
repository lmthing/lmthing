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

export const name = 'updateExpense';
export const description = 'Update fields on an expense.';

export interface Input {
  id: string;
  category?: string;
  description?: string;
  amount?: number;
  currency?: string;
  paidByTravelerId?: string;
  incurredAt?: string;
  bookingId?: string;
  itineraryItemId?: string;
}

export interface Expense {
  id: string;
  tripId: string;
  paidByTravelerId?: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurredAt?: string;
  bookingId?: string;
  itineraryItemId?: string;
  createdAt: string;
}

export type Output = Expense;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const set: Record<string, unknown> = {};
  if (input.category !== undefined) set.category = input.category;
  if (input.description !== undefined) set.description = input.description;
  if (input.amount !== undefined) set.amount = input.amount;
  if (input.currency !== undefined) set.currency = input.currency;
  if (input.paidByTravelerId !== undefined) set.paidByTravelerId = input.paidByTravelerId;
  if (input.incurredAt !== undefined) set.incurredAt = input.incurredAt;
  if (input.bookingId !== undefined) set.bookingId = input.bookingId;
  if (input.itineraryItemId !== undefined) set.itineraryItemId = input.itineraryItemId;

  await ctx.db.update('expenses', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('expenses', { where: { id: input.id } })) as Expense[];
  const expense = rows[0];
  if (!expense) {
    throw new HttpError(404, 'expense not found');
  }

  return expense;
}

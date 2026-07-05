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

export const name = 'getTraveler';
export const description = "Get a single traveler with their preferences and expense shares.";

export interface Input {
  id: string;
}

export interface TravelerPreference {
  id: string;
  travelerId: string;
  category: string;
  value: string;
  weight: number;
  notes?: string;
  createdAt: string;
}

export interface ExpenseShare {
  id: string;
  expenseId: string;
  travelerId: string;
  shareAmount: number;
  currency: string;
  settled: boolean;
  settledAt?: string;
}

export interface Traveler {
  id: string;
  tripId: string;
  name: string;
  role: string;
  homeCountry?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface Output extends Traveler {
  preferences: TravelerPreference[];
  shares: ExpenseShare[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('travelers', { where: { id: input.id } })) as Traveler[];
  const traveler = rows[0];
  if (!traveler) {
    throw new HttpError(404, 'traveler not found');
  }

  const preferences = (await ctx.db.query('traveler_preferences', {
    where: { travelerId: input.id },
  })) as TravelerPreference[];

  const shares = (await ctx.db.query('expense_shares', {
    where: { travelerId: input.id },
  })) as ExpenseShare[];

  return { ...traveler, preferences, shares };
}

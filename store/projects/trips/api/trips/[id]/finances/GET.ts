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

export const name = 'tripFinances';
export const description = 'Roll up a trip budget: booked cost, spent (currency-normalized), estimated-planned cost, remaining, and breakdowns by category and traveler.';

export interface Input {
  id: string;
}

interface Trip {
  id: string;
  homeCurrency?: string;
  budgetUsd?: number;
}

interface Booking {
  id: string;
  tripId: string;
  cost: number;
}

interface Expense {
  id: string;
  tripId: string;
  paidByTravelerId?: string;
  category: string;
  amount: number;
  currency: string;
}

interface Destination {
  id: string;
  tripId: string;
}

interface ItineraryItem {
  id: string;
  destinationId: string;
  estimatedCost: number;
  currency: string;
}

interface Traveler {
  id: string;
  tripId: string;
  name: string;
}

interface CurrencyRate {
  id: string;
  base: string;
  quote: string;
  rate: number;
  fetchedAt: string;
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export interface TravelerTotal {
  travelerId: string;
  name: string;
  paid: number;
}

export interface Output {
  homeCurrency: string;
  budget: number;
  booked: number;
  spent: number;
  estimatedPlanned: number;
  remaining: number;
  byCategory: CategoryTotal[];
  byTraveler: TravelerTotal[];
}

// Converts `amount` from `from` to `to` using the freshest matching currency_rates row.
// Falls back to a labelled 1:1 rate when no cached rate is found.
function convert(amount: number, from: string, to: string, rates: CurrencyRate[]): number {
  if (!from || !to || from === to) return amount;

  const matches = rates.filter((r) => r.base === from && r.quote === to);
  if (matches.length === 0) {
    // no cached rate — fall back to 1:1 (unconverted)
    return amount;
  }

  matches.sort((a, b) => (b.fetchedAt ?? '').localeCompare(a.fetchedAt ?? ''));
  return amount * matches[0].rate;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const trip = trips[0];
  if (!trip) {
    throw new HttpError(404, 'trip not found');
  }

  const homeCurrency = trip.homeCurrency ?? 'USD';
  const budget = trip.budgetUsd ?? 0;

  const bookings = (await ctx.db.query('bookings', { where: { tripId: input.id } })) as Booking[];
  const booked = bookings.reduce((sum, b) => sum + (b.cost ?? 0), 0);

  const expenses = (await ctx.db.query('expenses', { where: { tripId: input.id } })) as Expense[];
  const rates = (await ctx.db.query('currency_rates')) as CurrencyRate[];

  let spent = 0;
  const byCategoryMap = new Map<string, number>();
  for (const expense of expenses) {
    const normalized = convert(expense.amount ?? 0, expense.currency ?? homeCurrency, homeCurrency, rates);
    spent += normalized;
    byCategoryMap.set(expense.category, (byCategoryMap.get(expense.category) ?? 0) + normalized);
  }
  const byCategory: CategoryTotal[] = Array.from(byCategoryMap.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));

  const travelers = (await ctx.db.query('travelers', { where: { tripId: input.id } })) as Traveler[];
  const byTraveler: TravelerTotal[] = travelers.map((traveler) => {
    const paid = expenses
      .filter((e) => e.paidByTravelerId === traveler.id)
      .reduce((sum, e) => sum + convert(e.amount ?? 0, e.currency ?? homeCurrency, homeCurrency, rates), 0);
    return { travelerId: traveler.id, name: traveler.name, paid };
  });

  const destinations = (await ctx.db.query('destinations', { where: { tripId: input.id } })) as Destination[];
  const destIds = new Set(destinations.map((d) => d.id));
  const allItems = (await ctx.db.query('itinerary_items')) as ItineraryItem[];
  const items = allItems.filter((item) => destIds.has(item.destinationId));
  const estimatedPlanned = items.reduce(
    (sum, item) => sum + convert(item.estimatedCost ?? 0, item.currency ?? homeCurrency, homeCurrency, rates),
    0,
  );

  const remaining = budget - (booked + spent);

  return {
    homeCurrency,
    budget,
    booked,
    spent,
    estimatedPlanned,
    remaining,
    byCategory,
    byTraveler,
  };
}

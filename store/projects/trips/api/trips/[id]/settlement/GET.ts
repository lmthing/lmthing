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

export const name = 'settlement';
export const description = "Compute who owes whom on a trip: each traveler's paid/owed balance and a minimal set of settling transfers.";

export interface Input {
  id: string;
}

interface Traveler {
  id: string;
  tripId: string;
  name: string;
}

interface Expense {
  id: string;
  tripId: string;
  paidByTravelerId?: string;
  amount: number;
}

interface ExpenseShare {
  id: string;
  expenseId: string;
  travelerId: string;
  shareAmount: number;
  settled: boolean;
}

interface Trip {
  id: string;
  homeCurrency?: string;
}

export interface Balance {
  travelerId: string;
  name: string;
  paid: number;
  owes: number;
  net: number;
}

export interface Transfer {
  fromTravelerId: string;
  fromName: string;
  toTravelerId: string;
  toName: string;
  amount: number;
}

export interface Output {
  balances: Balance[];
  transfers: Transfer[];
  currency: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const currency = trips[0]?.homeCurrency ?? 'USD';

  const travelers = (await ctx.db.query('travelers', { where: { tripId: input.id } })) as Traveler[];
  const expenses = (await ctx.db.query('expenses', { where: { tripId: input.id } })) as Expense[];
  const expenseIds = new Set(expenses.map((e) => e.id));

  const allShares = (await ctx.db.query('expense_shares')) as ExpenseShare[];
  const shares = allShares.filter((s) => expenseIds.has(s.expenseId));

  // NOTE: mixed-currency normalization is handled by tripFinances; settlement treats
  // shareAmount/amount as already expressed in the trip homeCurrency for simplicity.
  const balances: Balance[] = travelers.map((traveler) => {
    const paid = expenses
      .filter((e) => e.paidByTravelerId === traveler.id)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const owes = shares
      .filter((s) => s.travelerId === traveler.id && !s.settled)
      .reduce((sum, s) => sum + (s.shareAmount ?? 0), 0);
    return {
      travelerId: traveler.id,
      name: traveler.name,
      paid,
      owes,
      net: paid - owes,
    };
  });

  const transfers = minimizeTransfers(balances);

  return { balances, transfers, currency };
}

// Greedy minimal-transfer settlement: repeatedly match the largest creditor
// (net > 0, is owed money) with the largest debtor (net < 0, owes money).
function minimizeTransfers(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ travelerId: b.travelerId, name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ travelerId: b.travelerId, name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.005) {
      transfers.push({
        fromTravelerId: debtor.travelerId,
        fromName: debtor.name,
        toTravelerId: creditor.travelerId,
        toName: creditor.name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.005) i++;
    if (creditor.amount <= 0.005) j++;
  }

  return transfers;
}

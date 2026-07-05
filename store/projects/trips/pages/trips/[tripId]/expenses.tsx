import React, { useMemo, useState } from 'react';
import type { Expense, Traveler } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { ExpenseRow } from '../../../components/ExpenseRow';
import { Spinner } from '../../../components/Spinner';

const CATEGORIES = ['lodging', 'transit', 'food', 'activity', 'shopping', 'fees', 'other'];

export default function TripExpenses({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [paidByTravelerId, setPaidByTravelerId] = useState('');

  const { data, isLoading, error } = useApi<{ expenses: Expense[] }>('listExpenses', {
    id: tripId,
  });
  const { data: travelersData } = useApi<{ travelers: Traveler[] }>('listTravelers', {
    id: tripId,
  });

  const expenses = data?.expenses ?? [];
  const travelers = travelersData?.travelers ?? [];
  const travelerName = (id?: string) => travelers.find((t) => t.id === id)?.name;

  const addExpense = useApiMutation<Expense>('addExpense', {
    invalidates: ['listExpenses', 'tripFinances', 'settlement'],
  });

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [expenses]);

  const byPayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = e.paidByTravelerId ?? 'unassigned';
      map.set(key, (map.get(key) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!description.trim() || !parsedAmount || parsedAmount <= 0) return;
    try {
      await addExpense.mutate({
        id: tripId,
        category,
        description: description.trim(),
        amount: parsedAmount,
        currency: currency.trim() || undefined,
        paidByTravelerId: paidByTravelerId || undefined,
      });
      setDescription('');
      setAmount('');
      setCurrency('');
      setPaidByTravelerId('');
      setCategory('other');
    } catch {
      // surfaced via addExpense.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="expenses" />

      <h1 className="text-2xl font-bold text-foreground">Expenses</h1>

      <form
        onSubmit={onAdd}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="expense-description">
            Description
          </label>
          <input
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="taxi to hotel"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="expense-category">
            Category
          </label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="expense-amount">
            Amount
          </label>
          <input
            id="expense-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="w-20 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="expense-currency">
            Currency
          </label>
          <input
            id="expense-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="expense-payer">
            Paid by
          </label>
          <select
            id="expense-payer"
            value={paidByTravelerId}
            onChange={(e) => setPaidByTravelerId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Unassigned</option>
            {travelers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={addExpense.isPending || !description.trim() || !amount}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load expenses.
        </div>
      ) : null}

      {!isLoading && !error && expenses.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No expenses yet. Add one above.
        </div>
      ) : null}

      <div className="space-y-2">
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} payerName={travelerName(expense.paidByTravelerId)} />
        ))}
      </div>

      {expenses.length > 0 ? (
        <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">By category</h2>
            <div className="space-y-1">
              {byCategory.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{cat}</span>
                  <span className="text-muted-foreground">{total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">By payer</h2>
            <div className="space-y-1">
              {byPayer.map(([travelerId, total]) => (
                <div key={travelerId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {travelerId === 'unassigned' ? 'Unassigned' : travelerName(travelerId) ?? travelerId}
                  </span>
                  <span className="text-muted-foreground">{total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

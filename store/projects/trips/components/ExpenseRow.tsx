import React from 'react';
import type { Expense } from '@app/types';
import { useApiMutation } from '@app/runtime';
import { CurrencyBadge } from './CurrencyBadge';

export function ExpenseRow({ expense, payerName }: { expense: Expense; payerName?: string }) {
  const removeExpense = useApiMutation<{ ok: boolean }>('removeExpense', {
    invalidates: ['listExpenses', 'tripFinances', 'settlement'],
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">{expense.description}</p>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {expense.category}
          </span>
          {payerName ? (
            <span className="text-xs text-muted-foreground">paid by {payerName}</span>
          ) : null}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-medium text-foreground">{expense.amount.toFixed(2)}</span>
        <CurrencyBadge currency={expense.currency} />
        <button
          type="button"
          onClick={() => removeExpense.mutate({ id: expense.id })}
          disabled={removeExpense.isPending}
          className="text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

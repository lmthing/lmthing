import React from 'react';
import { useApi } from '@app/runtime';

interface BudgetByKind {
  kind: string;
  booked: number;
  estimated: number;
}

interface Budget {
  budgetUsd: number;
  booked: number;
  estimated: number;
  remaining: number;
  byKind: BudgetByKind[];
}

export function BudgetStrip({ tripId }: { tripId: string }) {
  const { data: budget, isLoading } = useApi<Budget>('tripBudget', { id: tripId });

  if (isLoading || !budget) return null;

  const overBudget = budget.remaining < 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        Budget <span className="font-medium text-foreground">{budget.budgetUsd}</span>
      </span>
      <span className="text-muted-foreground">
        Booked <span className="font-medium text-foreground">{budget.booked}</span>
      </span>
      <span className="text-muted-foreground">
        Estimated <span className="font-medium text-foreground">{budget.estimated}</span>
      </span>
      <span className="text-muted-foreground">
        Remaining{' '}
        <span className={overBudget ? 'font-medium text-destructive' : 'font-medium text-foreground'}>
          {budget.remaining}
        </span>
      </span>
    </div>
  );
}

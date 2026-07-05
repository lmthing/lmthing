import React from 'react';
import type { Ingredient } from '@app/types';

function daysUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function ExpiringRow({ ingredient }: { ingredient: Ingredient }) {
  const days = daysUntil(ingredient.expiresAt);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{ingredient.name}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {ingredient.quantity} {ingredient.unit}
        </span>
      </div>
      {days != null ? (
        <span
          className={
            days <= 2
              ? 'shrink-0 rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive'
              : 'shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
          }
        >
          {days <= 0 ? 'expired' : `expires in ${days}d`}
        </span>
      ) : null}
    </div>
  );
}

export default ExpiringRow;

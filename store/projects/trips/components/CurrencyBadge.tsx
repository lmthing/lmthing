import React from 'react';

export function CurrencyBadge({ currency }: { currency: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
      {currency}
    </span>
  );
}

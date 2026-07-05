import React from 'react';

export function FinanceBar({
  label,
  value,
  max,
  currency,
}: {
  label: string;
  value: number;
  max: number;
  currency?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value.toFixed(2)}
          {currency ? ` ${currency}` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

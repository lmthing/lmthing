import React from 'react';
import { formatMoney } from './format';

export function SettlementRow({
  fromName,
  toName,
  amount,
  currency,
}: {
  fromName: string;
  toName: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <p className="text-foreground">
        <span className="font-medium">{fromName}</span> pays <span className="font-medium">{toName}</span>
      </p>
      <span className="shrink-0 font-medium text-foreground">
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

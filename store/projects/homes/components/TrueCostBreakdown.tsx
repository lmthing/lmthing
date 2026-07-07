import React from 'react';
import { formatMoney } from './format';

interface CostLine {
  label: string;
  amount: number;
  basis: string;
  note?: string;
}

export function TrueCostBreakdown({
  trueCostMonthly,
  costBreakdown,
  currency,
}: {
  trueCostMonthly: number;
  costBreakdown: CostLine[];
  currency: string;
}) {
  const lines = costBreakdown ?? [];
  const notedLines = lines.filter((l) => l.note);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        True cost / month
      </h3>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No breakdown yet — the surveyor hasn&apos;t costed this one out.
        </p>
      ) : (
        <div>
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                'flex items-center justify-between gap-3 py-1.5 text-sm ' +
                (i > 0 ? 'border-t border-border' : '')
              }
            >
              <span className="text-foreground">
                {line.label}
                {line.basis === 'estimated' ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">est.</span>
                ) : null}
              </span>
              <span className="shrink-0 font-medium text-foreground">
                {formatMoney(line.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="font-semibold text-foreground">Total</span>
        <span className="text-lg font-bold text-foreground">
          {formatMoney(trueCostMonthly, currency)}
        </span>
      </div>

      {notedLines.length > 0 ? (
        <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
          {notedLines.map((l, i) => (
            <li key={i}>
              <span className="font-medium text-foreground">{l.label}:</span> {l.note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

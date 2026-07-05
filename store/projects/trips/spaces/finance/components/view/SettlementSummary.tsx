import React from 'react';

/**
 * Renders a trip's per-traveler balances and the minimal set of transfers that settles everyone
 * up — shown in chat after the treasurer's `settle-summary` action runs.
 */
export function SettlementSummary({
  balances,
  transfers,
}: {
  balances: { name: string; net: number }[];
  transfers: { from: string; to: string; amount: number }[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-base font-semibold text-foreground">Settlement summary</h3>

      <ul className="mt-2 flex flex-col gap-1">
        {balances.map((b, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{b.name}</span>
            <span className={b.net < 0 ? 'text-destructive' : 'text-primary'}>
              {b.net < 0 ? `owes ${Math.abs(b.net).toFixed(2)}` : `is owed ${b.net.toFixed(2)}`}
            </span>
          </li>
        ))}
      </ul>

      {transfers.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-xs font-medium text-muted-foreground">To settle up</p>
          <ul className="mt-1 flex flex-col gap-1">
            {transfers.map((t, i) => (
              <li key={i} className="text-sm text-foreground">
                {t.from} &rarr; {t.to}: <span className="font-medium">{t.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Everyone is settled up.</p>
      )}
    </div>
  );
}

export default SettlementSummary;

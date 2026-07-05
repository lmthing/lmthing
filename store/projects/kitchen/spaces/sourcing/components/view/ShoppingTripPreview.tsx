import React from 'react';

/**
 * Confirms an organized shopping trip — shown in chat when the optimizer agent (or the
 * `organize-trip` tasklist) groups a plan's shopping-list gap by aisle and estimates the total
 * cost. `aisles` is already in store-walk order (produce → dairy → meat → bakery → pantry →
 * frozen → other) — this component only renders that order, it never re-sorts it.
 */
export function ShoppingTripPreview({
  estimatedCost,
  aisles,
}: {
  estimatedCost: number;
  aisles: { aisle: string; count: number }[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-foreground">Trip organized</span>
        <span className="text-muted-foreground">≈ ${estimatedCost.toFixed(2)}</span>
      </div>
      {aisles.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {aisles.map((a) => (
            <span
              key={a.aisle}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {a.aisle} · {a.count}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          Nothing left to buy for this plan.
        </div>
      )}
    </div>
  );
}

export default ShoppingTripPreview;

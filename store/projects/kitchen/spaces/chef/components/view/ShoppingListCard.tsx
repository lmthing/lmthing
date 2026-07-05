import React from 'react';

export interface ShoppingGapLine {
  ingredientName: string;
  quantity: number;
  unit: string;
  bought: boolean;
}

/**
 * A compact shopping-list card — shown in chat when the shopper reports a freshly recomputed
 * gap list. Each line is one ingredient the week needs beyond current pantry stock; a bought line
 * is shown struck through and de-emphasized rather than removed, so the household can see what's
 * already been picked up this trip.
 */
export function ShoppingListCard({ lines }: { lines: ShoppingGapLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        Nothing to buy — the pantry already covers this week.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-sm font-semibold text-foreground">Shopping list</div>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line) => (
          <li
            key={line.ingredientName}
            className={`flex items-baseline justify-between text-sm ${
              line.bought ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            <span>{line.ingredientName}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {Math.round(line.quantity * 100) / 100} {line.unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ShoppingListCard;

import React from 'react';

/**
 * One suggested ingredient swap — shown for a `substitutions` row the optimizer (or the
 * `substitutions` tasklist) just wrote: what's being replaced, what to use instead, the ratio to
 * use it at, and why the swap was suggested in the first place.
 */
export function SubstitutionCard({
  ingredientName,
  substituteName,
  ratio,
  reason,
  note,
}: {
  ingredientName: string;
  substituteName: string;
  ratio: number;
  reason: 'out-of-stock' | 'expiring' | 'cost' | 'dietary';
  note?: string;
}) {
  const reasonLabel: Record<typeof reason, string> = {
    'out-of-stock': 'Out of stock',
    expiring: 'Expiring soon',
    cost: 'Costs more than usual',
    dietary: "Doesn't fit your diet",
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-foreground">
          {ingredientName} → {substituteName}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {reasonLabel[reason]}
        </span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Use {ratio === 1 ? 'a 1:1' : `${ratio}x`} amount of {substituteName} per unit of{' '}
        {ingredientName}.
      </div>
      {note ? (
        <div className="mt-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

export default SubstitutionCard;

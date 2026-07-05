import React from 'react';

/**
 * A small pill for one macro value — e.g. `<MacroBadge label="Protein" value={32} unit="g" />` —
 * used when a single figure needs a label without the full `NutritionSummary` card.
 */
export function MacroBadge({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
      <span className="font-medium">{label}</span>
      <span>
        {Math.round(value)}
        {unit}
      </span>
    </span>
  );
}

export default MacroBadge;

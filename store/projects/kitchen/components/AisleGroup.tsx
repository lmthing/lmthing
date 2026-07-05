import React from 'react';

export interface AisleLine {
  ingredient: string;
  unit: string;
  quantity: number;
  estCost: number;
}

export function AisleGroup({ aisle, lines }: { aisle: string; lines: AisleLine[] }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-bold uppercase text-muted-foreground">{aisle}</h3>
      <ul className="space-y-1.5">
        {lines.map((line) => (
          <li key={line.ingredient} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 text-foreground">
              {line.ingredient}
              <span className="ml-2 text-muted-foreground">
                {line.quantity} {line.unit}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground">${line.estCost.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AisleGroup;

import React from 'react';

export interface Stats {
  recipes: number;
  pantryItems: number;
  lowStock: number;
  plannedMeals: number;
  shoppingGaps: number;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Tile label="Recipes" value={stats.recipes ?? 0} />
      <Tile label="Pantry items" value={stats.pantryItems ?? 0} />
      <Tile label="Low stock" value={stats.lowStock ?? 0} />
      <Tile label="Planned meals" value={stats.plannedMeals ?? 0} />
      <Tile label="Shopping gaps" value={stats.shoppingGaps ?? 0} />
    </div>
  );
}

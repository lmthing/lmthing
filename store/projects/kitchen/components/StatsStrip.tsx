import React from 'react';
import { BookOpen, Package, AlertTriangle, CalendarDays, ShoppingCart } from './icons';

export interface Stats {
  recipes: number;
  pantryItems: number;
  lowStock: number;
  plannedMeals: number;
  shoppingGaps: number;
}

function Tile({
  label,
  value,
  Icon,
  alert,
}: {
  label: string;
  value: number;
  Icon: typeof BookOpen;
  alert?: boolean;
}) {
  const active = alert && value > 0;
  return (
    <div
      className={
        active
          ? 'flex min-w-[7rem] flex-1 flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3'
          : 'flex min-w-[7rem] flex-1 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3'
      }
    >
      <Icon
        className={active ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-muted-foreground'}
        aria-hidden
      />
      <span className={active ? 'text-2xl font-bold text-destructive' : 'text-2xl font-bold text-foreground'}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Tile label="Recipes" value={stats.recipes ?? 0} Icon={BookOpen} />
      <Tile label="Pantry items" value={stats.pantryItems ?? 0} Icon={Package} />
      <Tile label="Low stock" value={stats.lowStock ?? 0} Icon={AlertTriangle} alert />
      <Tile label="Planned meals" value={stats.plannedMeals ?? 0} Icon={CalendarDays} />
      <Tile label="Shopping gaps" value={stats.shoppingGaps ?? 0} Icon={ShoppingCart} alert />
    </div>
  );
}

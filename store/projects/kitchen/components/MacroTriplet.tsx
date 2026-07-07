import React from 'react';

/**
 * The shared protein / carbs / fat visual language. One component, used identically on the recipe
 * detail, the Tonight card, and the nutrition dashboard so macros read as "the same thing"
 * everywhere. Rather than inventing new color tokens (which would require editing the shared design
 * system), the three macros are distinguished by opacity steps of the single `primary` token —
 * fully token-driven, never a raw color.
 */

export interface Macros {
  calories?: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MACROS: Array<{ key: 'protein' | 'carbs' | 'fat'; label: string; fill: string }> = [
  { key: 'protein', label: 'protein', fill: 'bg-primary' },
  { key: 'carbs', label: 'carbs', fill: 'bg-primary/60' },
  { key: 'fat', label: 'fat', fill: 'bg-primary/30' },
];

export function MacroTriplet({
  macros,
  size = 'md',
  showCalories = true,
}: {
  macros: Macros;
  size?: 'sm' | 'md';
  showCalories?: boolean;
}) {
  const valueClass = size === 'sm' ? 'text-sm font-semibold' : 'text-lg font-bold';

  return (
    <div className="flex items-center gap-4">
      {showCalories && macros.calories != null ? (
        <div className="flex flex-col">
          <span className={`${valueClass} text-foreground`}>{Math.round(macros.calories)}</span>
          <span className="text-xs text-muted-foreground">kcal</span>
        </div>
      ) : null}
      {MACROS.map((m) => (
        <div key={m.key} className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${m.fill}`} aria-hidden />
            <span className={`${valueClass} text-foreground`}>{Math.round(macros[m.key])}g</span>
          </span>
          <span className="pl-3.5 text-xs text-muted-foreground">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

export default MacroTriplet;

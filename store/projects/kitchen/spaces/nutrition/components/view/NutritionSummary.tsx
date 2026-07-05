import React from 'react';

/**
 * A compact nutrition summary card — shown in chat when the nutritionist reports a computed
 * meal's totals, or the coach explains the week. Calories are shown against `targetCalories` when
 * it's known; protein/carbs/fat are always shown as flat gram totals.
 */
export function NutritionSummary({
  calories,
  protein,
  carbs,
  fat,
  targetCalories,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories?: number;
}) {
  const pct =
    targetCalories && targetCalories > 0
      ? Math.min(100, Math.round((calories / targetCalories) * 100))
      : null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-foreground">{Math.round(calories)} kcal</span>
        {targetCalories ? (
          <span className="text-muted-foreground">of {Math.round(targetCalories)} kcal target</span>
        ) : null}
      </div>
      {pct !== null ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          Protein {Math.round(protein)}g
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          Carbs {Math.round(carbs)}g
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          Fat {Math.round(fat)}g
        </span>
      </div>
    </div>
  );
}

export default NutritionSummary;

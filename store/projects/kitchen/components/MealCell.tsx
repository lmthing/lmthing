import React from 'react';
import type { PlanMeal, Recipe } from '@app/types';
import { Link } from '@app/runtime';

export type MealWithRecipe = PlanMeal & { recipe: Recipe | null };

export function MealCell({
  meal,
  onRemove,
}: {
  meal: MealWithRecipe | null;
  onRemove?: () => void;
}) {
  if (!meal || !meal.recipe) {
    return (
      <div className="flex min-h-[4.5rem] items-center justify-center rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
        —
      </div>
    );
  }

  return (
    <div className="flex min-h-[4.5rem] flex-col justify-between gap-1 rounded-md border border-border bg-background p-2">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/recipes/${meal.recipe.id}`}
          className="text-sm font-medium text-foreground hover:text-primary"
        >
          {meal.recipe.title}
        </Link>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs text-destructive hover:underline"
          >
            ✕
          </button>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">{meal.servings ?? 2} servings</span>
    </div>
  );
}

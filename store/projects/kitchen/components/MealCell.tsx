import React from 'react';
import type { PlanMeal, Recipe } from '@app/types';
import { Link } from '@app/runtime';
import { Check, X } from './icons';
import { RatingStars } from './RatingStars';

export type MealWithRecipe = PlanMeal & { recipe: Recipe | null };

export function MealCell({
  meal,
  onRemove,
  onRate,
  onCook,
}: {
  meal: MealWithRecipe | null;
  onRemove?: () => void;
  onRate?: (rating: number) => void;
  onCook?: () => void;
}) {
  if (!meal || !meal.recipe) {
    return (
      <div className="flex min-h-[5.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-background p-2 text-xs text-muted-foreground">
        —
      </div>
    );
  }

  const cooked = Boolean(meal.cookedAt);

  return (
    <div className="flex min-h-[5.5rem] flex-col justify-between gap-1.5 rounded-lg border border-border bg-background p-2.5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/recipes/${meal.recipe.id}`}
          className="text-sm font-medium leading-tight text-foreground hover:text-primary"
        >
          {meal.recipe.title}
        </Link>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove meal"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <span className="text-xs text-muted-foreground">{meal.servings ?? 2} servings</span>

      <div className="flex items-center justify-between gap-1 pt-0.5">
        <RatingStars value={meal.rating ?? null} onRate={onRate} />
        {onCook ? (
          cooked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
              <Check className="h-3 w-3" /> Cooked
            </span>
          ) : (
            <button
              type="button"
              onClick={onCook}
              className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Mark cooked
            </button>
          )
        ) : cooked ? (
          <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary">
            <Check className="h-3 w-3" /> Cooked
          </span>
        ) : null}
      </div>
    </div>
  );
}

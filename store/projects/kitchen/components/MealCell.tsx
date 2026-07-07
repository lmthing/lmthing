import React from 'react';
import type { PlanMeal, Recipe } from '@app/types';
import { Link } from '@app/runtime';
import { Check, X, Plus, Utensils } from './icons';
import { RatingStars } from './RatingStars';

export type MealWithRecipe = PlanMeal & { recipe: Recipe | null; rationale?: string };

export function MealCell({
  meal,
  onRemove,
  onRate,
  onCook,
  onAdd,
  onDragStartMeal,
  onDropMeal,
}: {
  meal: MealWithRecipe | null;
  onRemove?: () => void;
  onRate?: (rating: number) => void;
  onCook?: () => void;
  /** fill an empty slot (opens the recipe picker). */
  onAdd?: () => void;
  /** begin dragging this meal to reschedule it. */
  onDragStartMeal?: () => void;
  /** a meal was dropped onto this cell. */
  onDropMeal?: () => void;
}) {
  const dropProps = onDropMeal
    ? {
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          onDropMeal();
        },
      }
    : {};

  if (!meal || !meal.recipe) {
    if (onAdd) {
      return (
        <button
          type="button"
          onClick={onAdd}
          {...dropProps}
          className="flex min-h-[5.5rem] items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-background p-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          aria-label="Add a meal"
        >
          <Plus className="h-3.5 w-3.5" /> add
        </button>
      );
    }
    return (
      <div
        {...dropProps}
        className="flex min-h-[5.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-background p-2 text-xs text-muted-foreground"
      >
        —
      </div>
    );
  }

  const cooked = Boolean(meal.cookedAt);
  const recipe = meal.recipe;

  return (
    <div
      draggable={Boolean(onDragStartMeal)}
      onDragStart={onDragStartMeal}
      {...dropProps}
      title={meal.rationale || undefined}
      className="flex min-h-[5.5rem] flex-col justify-between gap-1.5 rounded-lg border border-border bg-background p-2.5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-2">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Utensils className="h-3.5 w-3.5" />
          </span>
        )}
        <Link
          href={`/recipes/${recipe.id}`}
          className="min-w-0 flex-1 text-sm font-medium leading-tight text-foreground hover:text-primary"
        >
          {recipe.title}
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

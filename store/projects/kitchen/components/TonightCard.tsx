import React from 'react';
import type { PlanMeal, Recipe } from '@app/types';
import { Link } from '@app/runtime';
import { Check, Clock, Flame, Utensils } from './icons';
import { RatingStars } from './RatingStars';
import { MacroTriplet, type Macros } from './MacroTriplet';
import { formatDay } from './format';

export type TonightMeal = PlanMeal & { recipe: Recipe | null; rationale?: string };

/**
 * The single most-relevant slot (today's dinner) as a large hero card. Most days a user only cares
 * about one meal — make it a first-class object with the recipe image, prep time, a one-tap
 * Start cooking → Mark cooked flow, inline macros, and the after-cook rating prompt.
 */
export function TonightCard({
  meal,
  macros,
  cooked,
  onCook,
  onRate,
}: {
  meal: TonightMeal;
  macros?: Macros | null;
  cooked: boolean;
  onCook: () => void;
  onRate: (rating: number) => void;
}) {
  const recipe = meal.recipe;
  if (!recipe) return null;

  return (
    <section
      aria-label="Tonight"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="relative">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" className="h-44 w-full object-cover sm:h-56" />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-muted sm:h-56">
            <Utensils className="h-10 w-10 text-primary/60" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground backdrop-blur">
          <Flame className="mr-1 inline h-3 w-3 text-primary" />
          Tonight · {formatDay(meal.day)}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/recipes/${recipe.id}`}
            className="text-xl font-bold leading-tight text-foreground hover:text-primary"
          >
            {recipe.title}
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {recipe.prepMinutes ?? 30} min
          </span>
        </div>

        {meal.rationale ? (
          <p className="text-sm italic text-muted-foreground">{meal.rationale}</p>
        ) : null}

        {macros ? (
          <div className="rounded-lg border border-border bg-background p-3">
            <MacroTriplet macros={macros} size="sm" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            {cooked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" /> Cooked
              </span>
            ) : (
              <>
                <Link
                  href={`/recipes/${recipe.id}?cook=1`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Utensils className="h-4 w-4" /> Start cooking
                </Link>
                <button
                  type="button"
                  onClick={onCook}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Mark cooked
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {cooked ? (
              <span className="text-xs text-muted-foreground">How was it?</span>
            ) : null}
            <RatingStars value={meal.rating ?? null} onRate={onRate} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default TonightCard;

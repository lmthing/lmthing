import React, { useState } from 'react';
import { MealCell, type MealWithRecipe } from './MealCell';
import { formatDay } from './format';

const MEAL_SLOTS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

export function WeekGrid({
  meals,
  onRemoveMeal,
  onRateMeal,
  onCookMeal,
  onAddMeal,
  onMoveMeal,
}: {
  meals: MealWithRecipe[];
  onRemoveMeal?: (id: string) => void;
  onRateMeal?: (id: string, rating: number) => void;
  onCookMeal?: (id: string) => void;
  /** fill an empty (day, slot) — opens a recipe picker in the parent. */
  onAddMeal?: (day: string, slot: string) => void;
  /** drag-to-reschedule: move meal `id` to (day, slot). */
  onMoveMeal?: (id: string, day: string, slot: string) => void;
}) {
  const list = meals ?? [];
  const days = Array.from(new Set(list.map((m) => m.day))).sort();
  const [dragId, setDragId] = useState<string | null>(null);

  // Ensure a full 7-day frame even before every slot is filled, so "+ add" affordances appear.
  if (days.length === 0 && !onAddMeal) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No meals planned yet.
      </div>
    );
  }

  const byDayAndMeal = new Map<string, MealWithRecipe>();
  for (const m of list) {
    byDayAndMeal.set(`${m.day}:${m.meal}`, m);
  }

  const columns = days.length > 0 ? days : [];

  return (
    <div className="overflow-x-auto" role="grid" aria-label="This week's meals">
      <div
        className="grid min-w-[640px] gap-2"
        style={{ gridTemplateColumns: `6rem repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}
      >
        <div role="presentation" />
        {columns.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-center text-xs font-bold uppercase text-muted-foreground"
          >
            {formatDay(day)}
          </div>
        ))}

        {MEAL_SLOTS.map((slot) => (
          <React.Fragment key={slot}>
            <div
              role="rowheader"
              className="flex items-center text-xs font-bold uppercase text-muted-foreground"
            >
              {slot}
            </div>
            {columns.map((day) => {
              const meal = byDayAndMeal.get(`${day}:${slot}`) ?? null;
              return (
                <div role="gridcell" key={`${day}:${slot}`}>
                  <MealCell
                    meal={meal}
                    onRemove={meal && onRemoveMeal ? () => onRemoveMeal(meal.id) : undefined}
                    onRate={meal && onRateMeal ? (rating) => onRateMeal(meal.id, rating) : undefined}
                    onCook={meal && onCookMeal ? () => onCookMeal(meal.id) : undefined}
                    onAdd={!meal && onAddMeal ? () => onAddMeal(day, slot) : undefined}
                    onDragStartMeal={
                      meal && onMoveMeal ? () => setDragId(meal.id) : undefined
                    }
                    onDropMeal={
                      onMoveMeal
                        ? () => {
                            if (dragId && (!meal || meal.id !== dragId)) {
                              onMoveMeal(dragId, day, slot);
                            }
                            setDragId(null);
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

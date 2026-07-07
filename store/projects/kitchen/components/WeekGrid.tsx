import React from 'react';
import { MealCell, type MealWithRecipe } from './MealCell';
import { formatDay } from './format';

const MEAL_SLOTS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

export function WeekGrid({
  meals,
  onRemoveMeal,
  onRateMeal,
  onCookMeal,
}: {
  meals: MealWithRecipe[];
  onRemoveMeal?: (id: string) => void;
  onRateMeal?: (id: string, rating: number) => void;
  onCookMeal?: (id: string) => void;
}) {
  const list = meals ?? [];
  const days = Array.from(new Set(list.map((m) => m.day))).sort();

  if (days.length === 0) {
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

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px] gap-2"
        style={{ gridTemplateColumns: `6rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={day} className="text-center text-xs font-bold uppercase text-muted-foreground">
            {formatDay(day)}
          </div>
        ))}

        {MEAL_SLOTS.map((slot) => (
          <React.Fragment key={slot}>
            <div className="flex items-center text-xs font-bold uppercase text-muted-foreground">{slot}</div>
            {days.map((day) => {
              const meal = byDayAndMeal.get(`${day}:${slot}`) ?? null;
              return (
                <MealCell
                  key={`${day}:${slot}`}
                  meal={meal}
                  onRemove={meal && onRemoveMeal ? () => onRemoveMeal(meal.id) : undefined}
                  onRate={meal && onRateMeal ? (rating) => onRateMeal(meal.id, rating) : undefined}
                  onCook={meal && onCookMeal ? () => onCookMeal(meal.id) : undefined}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

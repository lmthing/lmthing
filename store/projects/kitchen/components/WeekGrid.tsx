import React from 'react';
import { MealCell, type MealWithRecipe } from './MealCell';

const MEAL_SLOTS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

function formatDay(day: string): string {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function WeekGrid({
  meals,
  onRemoveMeal,
}: {
  meals: MealWithRecipe[];
  onRemoveMeal?: (id: string) => void;
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
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

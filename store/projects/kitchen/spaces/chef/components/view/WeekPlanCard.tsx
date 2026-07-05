import React from 'react';

export interface WeekPlanDay {
  day: string;
  recipeTitle: string | null;
}

/**
 * A compact week-plan card — shown in chat when the planner reports a freshly slotted (or
 * partially slotted) week. One row per calendar day, with the recipe title if a dinner was
 * slotted or a muted "not planned" placeholder when a day was skipped (empty recipe box, or every
 * candidate filtered out).
 */
export function WeekPlanCard({ weekStart, days }: { weekStart: string; days: WeekPlanDay[] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-sm font-semibold text-foreground">Week of {weekStart}</div>
      <ul className="mt-2 flex flex-col gap-1">
        {days.map((d) => (
          <li key={d.day} className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{d.day}</span>
            {d.recipeTitle ? (
              <span className="font-medium text-foreground">{d.recipeTitle}</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                not planned
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WeekPlanCard;

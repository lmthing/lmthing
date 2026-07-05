---
id: flagDays
role: general
dependsOn: [computeEach]
functions: [macroTargetStatus]
output:
  flagged: number
---

Close the loop: for each day this pass actually touched, check whether the day's total lands far
outside the household's target and raise one `nutrition` suggestion if so. `computeEach`'s fan-out
result is in scope as an array (one `{ planMealId, day, calories, computed }` per pending slot):

```ts
const results = Array.isArray(computeEach) ? computeEach : [computeEach];
const touchedDays = [...new Set(results.filter(r => r.computed).map(r => r.day))];
```

Load the household target and, for each touched day, sum **every** `plan_meals` row for that day
(not just the ones this pass computed — a day can mix already-computed and newly-computed slots).
`plan_meals.day` is a plain column, so this is a direct `where`, then a per-slot `meal_nutrition`
lookup joined in memory:

```ts
const settings = db.query('settings')[0];
const target = (settings?.calorieTarget ?? 2000) * (settings?.householdSize ?? 2);

let flagged = 0;
for (const day of touchedDays) {
  const mealsForDay = db.query('plan_meals', { where: { day } });
  const dayCalories = mealsForDay.reduce((sum, m) => {
    const n = db.query('meal_nutrition', { where: { planMealId: m.id } })[0];
    return sum + (n?.calories ?? 0);
  }, 0);

  const status = macroTargetStatus(dayCalories, target);
  if (status === 'on-track') continue; // don't nudge over ordinary day-to-day variation

  const alreadyFlagged = db
    .query('suggestions')
    .some(s => s.type === 'nutrition' && !s.dismissed && (s.body ?? '').includes(day));
  if (alreadyFlagged) continue; // never duplicate a suggestion still pending for the same day

  db.insert('suggestions', {
    type: 'nutrition',
    title: status === 'under' ? `${day} is running low on calories` : `${day} is running high on calories`,
    body: `Planned meals for ${day} total about ${dayCalories} kcal against a target of ${target} kcal for the household.`,
    priority: 1,
  });
  flagged++;
}

currentTask.resolve({ flagged });
```

Guardrails:

- Reserve a suggestion for a day that's genuinely far from target (`macroTargetStatus`'s ±25% band
  already filters out ordinary variation) — don't insert one for every slightly-off day.
- Never fabricate a target: a missing/non-positive `calorieTarget`/`householdSize` means nothing is
  configured yet, and `macroTargetStatus` already treats that as `'on-track'` rather than flagging.

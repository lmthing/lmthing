---
id: summarize
role: explore
dependsOn: [loadWeek]
functions: [macroTargetStatus]
output:
  summary: string
  calorieStatus: string
  proteinStatus: string
  avgCalories: number
  avgProtein: number
---

Turn `loadWeek`'s totals into the plain-language summary — compare the daily average against the
household's target with `macroTargetStatus` (never hand-roll the ratio):

```ts
const settings = db.query('settings')[0];
const calorieTarget = (settings?.calorieTarget ?? 2000) * (settings?.householdSize ?? 2);
const proteinTarget = (settings?.proteinTarget ?? 80) * (settings?.householdSize ?? 2);
const avgCalories = loadWeek.totalCalories / loadWeek.days;
const avgProtein = loadWeek.totalProtein / loadWeek.days;
const calorieStatus = macroTargetStatus(avgCalories, calorieTarget);
const proteinStatus = macroTargetStatus(avgProtein, proteinTarget);
```

```ts
// Write the narrative yourself, in plain language a non-dietitian household member will
// understand — "on track", "running a bit low on protein" — never raw ratios or jargon. Per
// nutrition-science/macros-and-estimation, never present these numbers as more precise than the
// coarse estimates behind them.
const summary = '...'; // your plain-language weekly summary, grounded in the numbers above
currentTask.resolve({ summary, calorieStatus, proteinStatus, avgCalories, avgProtein });
```

`NutritionSummary` is the catalog component that can render these totals (with `targetCalories`)
in chat alongside the summary.

Guardrail: this pipeline never writes — see `coaching/not-a-dietitian` for how to phrase the
summary itself, and keep any goal change or nudge in the `chat` action's own steps.

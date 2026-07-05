---
id: loadWeek
role: explore
dependsOn: []
output:
  currentPlan: object
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  days: number
---

Load the most recent `meal_plans` row and sum its `meal_nutrition` (joined through `plan_meals`,
since `meal_nutrition` doesn't carry `planId` directly). `where` is equality-only, so the latest
plan and the join both happen in memory:

```ts
const plans = db.query('meal_plans').sort((a, b) => (b.weekStart ?? '').localeCompare(a.weekStart ?? ''));
const currentPlan = plans[0];
```

```ts
const meals = currentPlan ? db.query('plan_meals', { where: { planId: currentPlan.id } }) : [];
const nutrition = meals
  .map(m => db.query('meal_nutrition', { where: { planMealId: m.id } })[0])
  .filter(Boolean);
```

```ts
const totalCalories = nutrition.reduce((sum, n) => sum + (n.calories ?? 0), 0);
const totalProtein = nutrition.reduce((sum, n) => sum + (n.protein ?? 0), 0);
const totalCarbs = nutrition.reduce((sum, n) => sum + (n.carbs ?? 0), 0);
const totalFat = nutrition.reduce((sum, n) => sum + (n.fat ?? 0), 0);
const days = Math.max(1, new Set(meals.map(m => m.day)).size);
currentTask.resolve({ currentPlan, totalCalories, totalProtein, totalCarbs, totalFat, days });
```

If `meal_nutrition` is still missing for some or all of this week's slots (the nutritionist hasn't
caught up yet), these totals will simply read low — `summarize` must say so plainly rather than
presenting a partial sum as the whole week's picture.

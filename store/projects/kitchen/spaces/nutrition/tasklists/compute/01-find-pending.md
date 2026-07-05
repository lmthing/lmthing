---
id: findPending
role: explore
dependsOn: []
output:
  pending: array
---

Find every `plan_meals` slot that doesn't have a `meal_nutrition` row yet — the actual work this
compute run needs to do. `where` is **equality-only**, so build the "already computed" set in
memory rather than trying an anti-join in the query:

```ts
const meals = db.query('plan_meals');
const already = new Set(db.query('meal_nutrition').map(n => n.planMealId));
const pending = meals.filter(m => !already.has(m.id));
```

```ts
currentTask.resolve({ pending });
```

If `pending` comes back empty, the fan-out step below simply runs zero times — a re-trigger with
nothing new to do is not an error, just a no-op pass.

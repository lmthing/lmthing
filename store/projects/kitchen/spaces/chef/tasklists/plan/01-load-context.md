---
id: load_context
dependsOn: []
role: explore
output:
  plan: object
  recipes: array
  pantry: array
  settings: object
---

Load everything the rest of the plan run needs, read-only. `where` is **equality-only**, which is
exactly what an exact `id` match needs:

```ts
const plan = db.query('meal_plans', { where: { id: planId } })[0];
```

If there's no such plan, resolve with `plan: null` and the later steps will simply have nothing
to do — never fabricate a plan row here.

```ts
const recipes = db.query('recipes');
const pantry = db.query('ingredients');
const settings = db.query('settings')[0]; // single-row household prefs; may be undefined
currentTask.resolve({ plan: plan ?? null, recipes, pantry, settings: settings ?? null });
```

`recipes` here are the bare rows — `score_recipes` hydrates each candidate's ingredient lines
itself, since `include` only expands one relation hop at a time.

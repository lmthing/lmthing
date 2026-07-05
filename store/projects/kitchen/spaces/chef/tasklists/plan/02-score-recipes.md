---
id: score_recipes
dependsOn: [load_context]
role: general
functions: [coverageScore]
output:
  days: array
  candidates: array
---

Turn `load_context`'s raw `recipes`/`pantry`/`settings` into the two things the day-by-day fan-out
needs: the list of calendar days to fill, and a ranked list of candidate recipes.

Compute the 7 calendar days of the plan's week from `plan.weekStart` (Monday), as ISO date
strings — this is what `slot_day` fans out over:

```ts
const days: string[] = [];
if (load_context.plan) {
  const start = new Date(load_context.plan.weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
}
```

Apply the household's diet/allergy/dislike/cuisine/time preferences directly — see
`meal-planning/dietary-constraints`'s `allergies-and-diets.md` for the full reasoning behind each
check. Diet and allergies are a **hard** exclusion; dislikes/cuisine/time are soft
de-prioritization handled by the scoring pass below, not a filter:

```ts
const settings = load_context.settings;
const dietConflict = (r: typeof load_context.recipes[number]) => {
  const tags: string[] = r.tags ?? [];
  if (settings?.diet === 'vegetarian' && tags.includes('meat')) return true;
  if (settings?.diet === 'vegan' && (tags.includes('meat') || tags.includes('dairy') || tags.includes('egg'))) return true;
  if (settings?.diet === 'pescatarian' && tags.includes('meat') && !tags.includes('fish')) return true;
  return false;
};
const allergyConflict = (r: typeof load_context.recipes[number]) => {
  const allergies: string[] = settings?.allergies ?? [];
  const tags: string[] = r.tags ?? [];
  return allergies.some((a) => tags.includes(a.toLowerCase()));
};
const eligible = load_context.recipes.filter((r) => !dietConflict(r) && !allergyConflict(r));
```

For each eligible recipe, hydrate its ingredient lines with a single-hop `include` and score how
well the pantry covers it:

```ts
const pantryStock: Record<string, number> = {};
for (const ing of load_context.pantry) pantryStock[ing.id] = ing.quantity;

const candidates = eligible.map((r) => {
  const hydrated = db.query('recipes', { where: { id: r.id }, include: ['ingredients'] })[0];
  const score = coverageScore(hydrated.ingredients, pantryStock, r.servings);
  return { recipeId: r.id, score };
});
candidates.sort((a, b) => b.score - a.score); // best-covered first
```

```ts
currentTask.resolve({ days, candidates });
```

Guardrails:

- This task only reads and scores — it never writes `plan_meals` itself; that's `slot_day`'s job.
- If `eligible` ends up empty (e.g. every recipe conflicts with an allergy), still resolve with an
  empty `candidates` array — `finalize` will mark the plan `ready` with zero slots rather than
  fabricating a recipe.
- Never treat a `dislikes` or `cuisines` mismatch as disqualifying — those are preferences the day
  picker in `slot_day` should weigh, not a hard filter like diet/allergies.

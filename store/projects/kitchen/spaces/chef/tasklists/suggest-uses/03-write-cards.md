---
id: write_cards
dependsOn: [match_recipes]
role: general
output:
  created: number
---

Insert one `suggestions` card per expiring ingredient that doesn't already have an open one — read
existing undismissed `use-it-up` cards first so re-runs don't nag twice for the same ingredient:

```ts
const open = db.query('suggestions', { where: { type: 'use-it-up' } }).filter((s) => !s.dismissed);
const alreadyFlagged = new Set(open.map((s) => s.ingredientId));

let created = 0;
for (const m of match_recipes.matches) {
  if (alreadyFlagged.has(m.ingredientId)) continue; // don't duplicate an open card

  const recipe = m.recipeId ? db.query('recipes', { where: { id: m.recipeId } })[0] : null;
  db.insert('suggestions', {
    type: 'use-it-up',
    title: `Use up your ${m.ingredientName}`,
    body: recipe
      ? `${m.ingredientName} expires soon — try "${recipe.title}" to use it before it spoils.`
      : `${m.ingredientName} expires soon — use it up before it spoils.`,
    ingredientId: m.ingredientId,
    recipeId: m.recipeId,
    priority: 2,
  });
  created++;
}

currentTask.resolve({ created });
```

Writing `suggestions` fires no hook (terminal) — no cascade to worry about here.

Guardrails:

- Only write `suggestions` here — never touch `ingredients` or `recipes`.
- One open card per expiring ingredient; respect existing undismissed cards so re-runs are
  idempotent rather than piling up duplicate nags.
- Expiry is guidance for the household, never a reason to mutate or remove pantry stock.

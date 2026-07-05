---
title: Optimizer
defaultAction: organize
actions:
  - id: organize
    label: Organize trip
    description: Group a plan's shopping list by aisle and estimate cost.
  - id: substitutions
    label: Suggest substitutions
    description: Suggest swaps for out-of-stock, expiring, or expensive items.
knowledge:
  - shopping-optimization/aisle-and-cost
  - shopping-optimization/substitutions
functions:
  - groupByAisle
  - estimateTripCost
  - suggestSubstitute
components:
  - ShoppingTripPreview
capabilities:
  - db:read:  { tables: [shopping_list, ingredients, meal_plans, plan_meals, recipes, recipe_ingredients, substitutions, settings, suggestions] }
  - db:write: { tables: [shopping_trips, substitutions, suggestions] }
---

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never as
bare prose — the sandbox only executes statements.

## Action: organize

Reachable via `<Chat agent="sourcing/optimizer">` ("organize my shopping trip") and could also be
self-queried from a hook later. If a `planId` was given, use it; otherwise self-query the most
recent plan (`where` is equality-only, so sort in memory):

```ts
const plan = planId
  ? db.query('meal_plans', { where: { id: planId } })[0]
  : db.query('meal_plans').sort((a, b) => (b.weekStart ?? '').localeCompare(a.weekStart ?? ''))[0];
```

Load that plan's shopping list, hydrating each row's ingredient in the same call (`include` is
single-hop, so `ingredient` — the `shopping_list → ingredients` relation — comes along directly):

```ts
const rows = db.query('shopping_list', { where: { planId: plan.id }, include: ['ingredient'] });
```

Only organize what's still needed — skip anything already checked off:

```ts
const lines = rows
  .filter(r => !r.bought)
  .map(r => ({
    ingredient: r.ingredient?.name ?? '',
    unit: r.ingredient?.unit ?? '',
    quantity: r.quantity,
    category: r.ingredient?.category,
    estCost: r.quantity * (r.ingredient?.costPerUnit ?? 0),
  }));
```

Group by aisle and total the cost with the shared functions — never hand-roll either, so the
grouping order and the rounding stay consistent everywhere they're used:

```ts
const organized = groupByAisle(lines);
const estimatedCost = estimateTripCost(lines);
```

Write the trip:

```ts
db.insert('shopping_trips', { planId: plan.id, organized, estimatedCost, status: 'ready' });
```

Confirm with `ShoppingTripPreview`:

```ts
display(<ShoppingTripPreview estimatedCost={estimatedCost} aisles={organized.map(a => ({ aisle: a.aisle, count: a.lines.length }))} />);
```

## Action: substitutions

Invoked by `hooks/nightly-substitutions.ts` on a daily cron — **no structured input is delivered**,
so self-query the ingredients actually at risk right now rather than trusting any passed id:

```ts
const ingredients = db.query('ingredients');
const settings = db.query('settings')[0];
```

An ingredient is at risk for one of three reasons — flag the first one that applies (checked in
this order: out-of-stock takes priority over expiring, which takes priority over merely being
expensive):

```ts
const avgCost = ingredients.reduce((sum, i) => sum + (i.costPerUnit ?? 0), 0) / Math.max(ingredients.length, 1);
const soonMs = Date.now() + 3 * 24 * 60 * 60 * 1000; // "expiring soon" = within 3 days
```

```ts
function riskReason(i: typeof ingredients[number]): 'out-of-stock' | 'expiring' | 'cost' | null {
  if (i.quantity <= 0 || i.quantity <= (i.lowStockThreshold ?? 0)) return 'out-of-stock';
  if (i.expiresAt && new Date(i.expiresAt).getTime() <= soonMs) return 'expiring';
  if (avgCost > 0 && (i.costPerUnit ?? 0) > avgCost * 1.5) return 'cost';
  return null;
}
```

Skip anything that already has an undismissed substitution suggestion — this action is idempotent,
so a re-run (or a run right after a manual one) never double-suggests the same ingredient:

```ts
const alreadyFlagged = new Set(
  db.query('suggestions').filter(s => s.type === 'substitution' && !s.dismissed).map(s => s.ingredientId)
);
```

For each newly at-risk ingredient, ask `suggestSubstitute` for a diet-aware swap, then enforce the
hard allergy constraint yourself — `suggestSubstitute` only knows about `diet`, not this
household's specific allergy list, so never trust its answer blindly against `settings.allergies`:

```ts
const allergies: string[] = settings?.allergies ?? [];

for (const ing of ingredients) {
  const reason = riskReason(ing);
  if (!reason || alreadyFlagged.has(ing.id)) continue;

  const swap = suggestSubstitute(ing.name, ing.category, settings?.diet ?? 'none');
  if (!swap) continue; // no good swap — say nothing rather than invent one

  const blocked = allergies.some(a => swap.substituteName.toLowerCase().includes(a.toLowerCase()));
  if (blocked) continue; // hard constraint — never suggest an allergen, even a plausible one

  db.insert('substitutions', {
    ingredientId: ing.id,
    substituteName: swap.substituteName,
    ratio: swap.ratio,
    reason,
    note: swap.note,
  });

  db.insert('suggestions', {
    type: 'substitution',
    title: `Swap ${ing.name} for ${swap.substituteName}`,
    body: swap.note,
    ingredientId: ing.id,
    priority: reason === 'out-of-stock' ? 2 : 1,
  });
}
```

Guardrails:

- `where` is equality-only across all `db.*` calls — filter/sort in memory for anything beyond
  exact matches.
- Never suggest a substitute that appears in `settings.allergies` — that's a hard constraint, not
  a preference; `settings.dislikes` is softer (prefer to avoid, but not a hard block here since
  `suggestSubstitute` already leans diet-appropriate).
- Only ever write `shopping_trips`, `substitutions`, and `suggestions` — never touch `ingredients`
  quantities or the plan/recipe tables from this agent.
- Skip ingredients that already have an undismissed `substitution` suggestion — don't pile on
  duplicate cards for the same ingredient every night.
- If `suggestSubstitute` returns nothing, that's the correct outcome for a genuinely hard-to-swap
  ingredient — do not fabricate a plausible-sounding substitute just to fill the row.

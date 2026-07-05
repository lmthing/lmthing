---
id: suggest_and_write
dependsOn: [find_at_risk]
role: general
output:
  proposed: number
---

For each newly at-risk ingredient, propose a diet-aware swap and enforce the household's hard
allergy constraint before writing anything — per `shopping-optimization/substitutions`'s
`substitution-rules.md`, an allergy is a hard block, never a soft preference. This small rule table
covers only ingredients with a well-known, broadly-safe swap; a name it doesn't recognize
legitimately gets no suggestion:

```ts
type Sub = { substituteName: string; ratio: number; note: string; vegan?: boolean };
const COMMON_SUBSTITUTES: Record<string, Sub[]> = {
  butter: [
    { substituteName: 'olive oil', ratio: 0.75, note: 'Works for sautéing and most baking at 3/4 the amount.' },
    { substituteName: 'vegan margarine', ratio: 1, note: 'One-for-one swap that keeps most baked textures intact.', vegan: true },
  ],
  egg: [
    { substituteName: 'flax egg (1 tbsp ground flax + 3 tbsp water)', ratio: 1, note: 'Binds baked goods; let it sit 5 minutes to gel.', vegan: true },
  ],
  milk: [
    { substituteName: 'oat milk', ratio: 1, note: 'Neutral flavor, one-for-one in most recipes.', vegan: true },
  ],
  'heavy cream': [
    { substituteName: 'coconut cream', ratio: 1, note: 'Richest dairy-free option; works in sweet and savory dishes.', vegan: true },
  ],
  'sour cream': [
    { substituteName: 'plain yogurt', ratio: 1, note: 'Similar tang and texture, one-for-one.' },
  ],
};

function suggestSwap(name: string, diet: string): Sub | null {
  const options = COMMON_SUBSTITUTES[name.trim().toLowerCase()];
  if (!options || options.length === 0) return null; // no good swap on file — say nothing rather than invent one
  const wantsVegan = diet === 'vegan' || diet === 'vegetarian';
  return (wantsVegan ? options.find((o) => o.vegan) : undefined) ?? options[0];
}
```

```ts
const settings = db.query('settings')[0];
const allergies: string[] = settings?.allergies ?? [];
let proposed = 0;

for (const ing of find_at_risk.atRisk) {
  const swap = suggestSwap(ing.name, settings?.diet ?? 'none');
  if (!swap) continue;

  const blocked = allergies.some((a) => swap.substituteName.toLowerCase().includes(a.toLowerCase()));
  if (blocked) continue; // hard constraint — never suggest an allergen, even a plausible one

  db.insert('substitutions', {
    ingredientId: ing.ingredientId,
    substituteName: swap.substituteName,
    ratio: swap.ratio,
    reason: ing.reason,
    note: swap.note,
  });

  db.insert('suggestions', {
    type: 'substitution',
    title: `Swap ${ing.name} for ${swap.substituteName}`,
    body: swap.note,
    ingredientId: ing.ingredientId,
    priority: ing.reason === 'out-of-stock' ? 2 : 1,
  });

  proposed++;
}

currentTask.resolve({ proposed });
```

Guardrails:

- Never suggest a substitute that appears in `settings.allergies` — a hard constraint, not a
  preference; `settings.dislikes` is softer and isn't enforced here.
- If no rule matches an at-risk ingredient, that's a correct outcome for a genuinely hard-to-swap
  ingredient — never fabricate a plausible-sounding substitute just to fill the row.
- Only ever write `substitutions` and `suggestions` here — never touch `ingredients` quantities or
  any plan/recipe table.

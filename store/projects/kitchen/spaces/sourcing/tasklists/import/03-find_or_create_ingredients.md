---
id: find_or_create_ingredients
dependsOn: [parse]
role: general
output:
  lines: array
---

Find-or-create each parsed ingredient against the pantry the household already has, rather than
inserting a fresh duplicate every time a recipe phrases a familiar ingredient slightly differently —
see `recipe-import/parsing-web-recipes`'s `ingredient-normalization.md` for the matching rationale.
Nothing runs when `parse` found nothing — there is nothing to match or create:

```ts
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/s$/, '');
const existing = db.query('ingredients');
const lines: { ingredientId: string; quantity: number; unit: string }[] = [];

if (parse.ok) {
  for (const line of parse.ingredients) {
    const target = normalize(line.name);
    let match = existing.find((i) => normalize(i.name) === target);
    if (!match) {
      match = db.insert('ingredients', { name: line.name, unit: line.unit, quantity: 0 });
      existing.push(match); // so a later line on this same page can match it too
    }
    lines.push({ ingredientId: match.id, quantity: line.quantity, unit: line.unit });
  }
}

currentTask.resolve({ lines });
```

Guardrails:

- Never fabricate a line that wasn't in `parse.ingredients` — this task only turns already-parsed
  lines into ingredient ids, it never adds to or edits the list itself.
- Prefer an existing ingredient over inserting a near-duplicate; only create a new row when no
  reasonable name match exists in the pantry.

---
id: find_expiring
dependsOn: []
role: explore
functions: [expiringSoon]
output:
  expiring: array
---

Read the pantry and narrow it to what's genuinely expiring soon — no structured input for this
tasklist, so this is the first self-query:

```ts
const pantry = db.query('ingredients');
const expiring = expiringSoon(pantry, 3); // within 3 days, sorted soonest-first
currentTask.resolve({ expiring });
```

If nothing is expiring, resolve with an empty array — `match_recipes` and `write_cards` will
simply have nothing to do. Don't invent urgency where there is none.

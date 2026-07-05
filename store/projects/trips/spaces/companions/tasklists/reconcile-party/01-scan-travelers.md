---
id: scan_travelers
output:
  merged: array
dependsOn: []
role: plan
functions:
  - mergePreferences
---

Read every traveler on the trip and their recorded preferences, then merge them with
`mergePreferences` into one collective, category-grouped view of the party's constraints.
`tripId` is in scope from the tasklist input.

```ts
const travelers = db.query('travelers', { where: { tripId } });
const allPrefs = travelers.flatMap(t =>
  db.query('traveler_preferences', { where: { travelerId: t.id } }),
);

const merged = mergePreferences(allPrefs);

currentTask.resolve({ merged });
```

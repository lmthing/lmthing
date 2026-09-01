---
id: discover
dependsOn: []
role: explore
functions:
  - discoverQueueTables
output:
  candidates: array
  candidateCount: number
---

Find which sibling queue tables are actually present. The registry lives inside the function — do
not re-derive it, and do not invent sources it does not know:

```ts
const candidates = discoverQueueTables(db.tables());
currentTask.resolve({ candidates, candidateCount: candidates.length });
```

An empty result is a valid outcome: it means no other utility space is installed yet, and the
dispatcher simply has nothing to route.

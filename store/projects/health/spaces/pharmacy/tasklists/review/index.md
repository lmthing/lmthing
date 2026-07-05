---
input:
  trigger: string
---

Fill in every pending `interactions` row with a cited literature finding. `trigger` is not
threaded into the tasks below — like the pharmacist's own `review` action this tasklist parallels,
the hook that starts this run carries no id, so `load-pending` self-queries the actual state from
the database: every `interactions` row still `pending`, alongside the medication each one concerns.
`research` fans out over those pairs and uses the universal `webSearch`/`webFetch` globals to find
reputable literature on each one, and `write` persists a concise cited finding with
`severity`/`otherName` and marks the row `ready`.

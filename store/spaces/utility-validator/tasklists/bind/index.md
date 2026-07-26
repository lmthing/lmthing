---
input:
  trigger: string?
---

Derive the project's data contracts and persist them for review: inventory the schema with real
sampled rows, run `suggestRules` over the evidence, then create this space's own tables (if absent)
and insert deduped `validation_rules` rows — **all at `status: 'proposed'`**. `trigger` is not
threaded into the steps: bind self-queries everything it needs, so a re-run is always safe and
never activates anything.

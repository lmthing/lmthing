---
input: {}
---

Estimate and persist `nutrition_facts` for every ingredient used in a recipe line that doesn't have
them yet, then report the touched recipes' per-serving totals in chat. This tasklist takes **no
recipe id from the caller** — `hooks/enrich-recipe-nutrition.ts` fires on any `recipes` insert
without saying which one, so it self-queries across every recipe's ingredient lines for the gap. A
recipe's per-serving totals are never persisted anywhere (`recipes` carries no total-nutrition
columns; `getRecipeNutrition` computes the same numbers on demand for the UI) — the report step
here exists to narrate what was just estimated, not to write a new row.

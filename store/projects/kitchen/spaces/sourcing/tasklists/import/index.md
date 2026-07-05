---
input:
  url: string
  recipeId: string
---

Turn a recipe web page into a real recipe end-to-end: fetch it, parse it with `parseRecipe`
(JSON-LD first, heuristic fallback second), find-or-create each ingredient against the existing
pantry, then persist the recipe and its ingredient lines. Mirrors the importer agent's `import`
action as a tasklist — the shape `api/recipes/import/POST.ts`'s stub-then-fill flow will drive once
`spawn`/`delegate` wiring lands, and a natural fit for a future hook. `recipeId` names an existing
stub `recipes` row (`source` set, `instructions` still empty) to fill in in place; `url` is used
directly when there's no stub. A page that doesn't fetch or doesn't parse into anything recognizable
leaves the stub exactly as it was — this tasklist never fabricates a recipe to fill the gap.

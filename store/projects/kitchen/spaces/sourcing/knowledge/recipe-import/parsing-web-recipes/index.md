---
variable: parsingWebRecipes
description: Turning a fetched recipe page's raw HTML into a title, ingredient lines, and instructions without ever fabricating what the page didn't actually say.
---

# Parsing web recipes

Recipe pages are one of the least standardized corners of the web: the same dish can arrive as
clean schema.org markup, a WordPress theme's bespoke ingredient widget, or a wall of prose with the
ingredient list buried in a `<div>` between two ads. `parseRecipe` (`sourcing/functions/parseRecipe.ts`)
is the one place this mess gets turned into a `ParsedRecipe` — a title, description, instructions
string, optional servings, and an array of `{ name, quantity, unit }` ingredient lines — and every
agent and task in this space that touches a fetched page routes through it rather than re-deriving
its own ad hoc scraping logic.

The core discipline that makes this parser trustworthy is refusing to guess. A page that doesn't
contain a recognizable recipe comes back with an empty `title` and an empty `ingredients` array,
not a best-effort title scraped from the page's `<title>` tag dressed up to look like a real result.
Every ingredient line that does come back is traceable to actual text on the page — a
`recipeIngredient` entry in JSON-LD, or a line item the heuristic fallback found — never a plausible
guess about what a dish "probably" needs. This matters because the agents consuming `parseRecipe`'s
output (the importer, and the `import` tasklist) are instructed to treat an empty result as "I
couldn't find a recipe here," and that promise only holds if the parser itself never quietly
invents something to avoid returning empty-handed.

`extraction-strategy.md` covers the actual extraction order — structured data first, then a narrow
heuristic fallback, and where the line is between "reasonable fallback" and "guessing" — while
`ingredient-normalization.md` covers what happens after raw ingredient lines are extracted: turning
free text like "2 cups all-purpose flour" into a quantity/unit/name triple, and matching that name
against the pantry the household already has (`matchIngredient`) rather than inserting a fresh,
near-duplicate row every time a recipe happens to phrase an ingredient slightly differently.

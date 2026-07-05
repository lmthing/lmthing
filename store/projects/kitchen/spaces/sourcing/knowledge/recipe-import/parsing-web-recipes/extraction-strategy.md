# Extraction strategy: structured first, heuristic second, honest failure third

## Tier 1 — JSON-LD `Recipe` schema

The overwhelming majority of recipe sites that care about search visibility embed a
`<script type="application/ld+json">` block following [schema.org/Recipe](https://schema.org/Recipe),
because that's what makes Google show the recipe card, star rating, and cook time directly in search
results. This is the single most reliable source available: it's the same structured data the page
author deliberately fed to search engines, so it's already been through the site's own QA for
correctness (a wrong ingredient in the JSON-LD would show up wrong in Google's own recipe rich
results, which site owners notice and fix).

Extraction here means: find the `<script>` block(s), `JSON.parse` the contents, and walk the result
looking for a node whose `@type` is `"Recipe"` (or an array containing `"Recipe"`) — the JSON-LD can
be a single object, an array of objects, or wrapped in a top-level `@graph` array alongside
`Organization`/`BreadcrumbList`/other schema nodes for the same page, so all three shapes need
walking. Once found, `recipeIngredient` is an array of free-text ingredient line strings,
`recipeInstructions` can be a plain string, an array of strings, or an array of `HowToStep` objects
(each with a `text` or `name` field), and `recipeYield` can be `"4"`, `"4 servings"`, or a bare
number — each of these needs its own small normalization, not a single generic string-to-anything
coercion.

A malformed JSON-LD block (invalid JSON, or valid JSON with no `Recipe` node) is not an error worth
surfacing — just skip that block and try the next one, or fall through to Tier 2. Real pages
sometimes carry multiple `<script type="application/ld+json">` blocks for different purposes (one
for the recipe, one for the site's organization info, one for breadcrumbs) and only one of them will
ever be the recipe.

## Tier 2 — heuristic fallback

When no JSON-LD `Recipe` node exists, the honest move is to extract *only* what can be found with
real confidence and leave the rest blank — not to build an elaborate heuristic that tries to guess
which `<ul>` on the page is "probably" the ingredient list. In practice that means: pull a title from
the first `<h1>` or the `<title>` tag (titles are structurally unambiguous — there's only one page
title), and stop there. Do not attempt to heuristically identify ingredient lists or instruction
steps from raw HTML structure — recipe page layouts vary too wildly (some list ingredients in a
`<ul>`, some in a table, some inline in prose with a bold ingredient name) for a generic heuristic to
be reliably correct, and a *wrong* ingredient list is worse than an honestly empty one, since a wrong
list looks plausible enough that an agent might act on it without double-checking.

## Tier 3 — honest failure

If neither tier produces a title or any ingredients, the result is the same either way: an empty
`ParsedRecipe` (`title: ''`, `instructions: ''`, `ingredients: []`). This is the signal, all the way
up the call chain, that this page did not yield a usable recipe. The calling agent or task's job at
that point is to say so plainly — "I couldn't find a recipe on that page" — never to paper over the
gap with a plausible-sounding placeholder recipe. A stub `recipes` row left with `instructions: ''`
is a completely acceptable terminal state; a stub filled in with fabricated content is not.

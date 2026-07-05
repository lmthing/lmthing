# Allergies and diets

## Recognizing a diet conflict from tags, not guesswork

Recipes carry a `tags` array (e.g. `'vegetarian'`, `'quick'`, a cuisine name) rather than a
structured "contains meat: yes/no" column, so a diet check has to reason from whatever tags and
ingredient names are actually present. A `vegetarian` household diet conflicts with a recipe
tagged `'meat'` or `'fish'`, or one whose hydrated `recipe_ingredients` lines reference an
ingredient categorized (or named) as meat/poultry/fish/seafood. `vegan` is strictly narrower than
vegetarian — it additionally excludes dairy, eggs, and honey, so a recipe merely tagged
`'vegetarian'` is not automatically vegan-safe; check for dairy/egg ingredients explicitly rather
than assuming the vegetarian tag covers it. `pescatarian` is the mirror case: it excludes land
meat but allows fish/seafood, so a recipe tagged `'fish'` alone should pass even though a generic
"no meat" check might otherwise flag it as ambiguous.

When a recipe's tags don't clearly settle the question — no tag either way, and the ingredient
list doesn't obviously fall into a meat/dairy/egg category — treat the missing signal as a
reason for caution proportional to the stakes: for a diet preference, a recipe with genuinely
ambiguous ingredients can be included; for an allergy, ambiguity should count as a conflict. The
asymmetry matters: guessing wrong on a diet preference produces a suboptimal week, guessing wrong
on an allergy produces a household member eating something that could hurt them.

## Allergen families, not just exact ingredient names

`settings.allergies` is a flat array of strings, but a real allergy check needs to think in terms
of allergen **families**, not exact string matches. "Nuts" as a listed allergy should catch
`'peanut'`, `'almond'`, `'cashew'`, `'walnut'`, and any other tree nut or peanut ingredient — not
just a literal ingredient named `'nuts'`. "Shellfish" should catch shrimp, crab, prawns, and
lobster. "Dairy" should catch milk, cheese, yogurt, cream, and butter, even though those are all
different ingredient names. Build the match by checking whether a recipe's ingredient names or
category field fall within the same family as the listed allergen — a substring/keyword match
against a small family vocabulary, similar in spirit to the nutrition space's category-keyword
matching — rather than requiring an exact string equality that will silently miss the vast
majority of real-world matches.

## Cross-contamination is a caveat to surface, not a filter to enforce

This chef app has no way to know whether a kitchen is nut-free or whether cross-contamination
during store-bought ingredient processing is a real risk for a given household's severity of
allergy — that's outside what `recipes`/`ingredients` can express. The right scope for the
planner is to exclude recipes whose ingredients directly contain a listed allergen; it should not
attempt to reason about trace/cross-contamination risk on manufactured ingredients (e.g. "this oat
product may be processed in a facility that also processes nuts") since that information isn't in
the schema and fabricating it would be worse than staying silent. If a household's allergy is
severe enough to need that level of care, that's a conversation the pantry keeper or user handles
outside the plan, not something the planner should attempt to model with data it doesn't have.

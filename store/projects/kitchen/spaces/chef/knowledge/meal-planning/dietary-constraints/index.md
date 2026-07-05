---
variable: dietaryConstraints
description: How diet/allergy/dislike filtering, cuisine preference, and prep-time caps should be applied when scoring and slotting recipes.
---

# Dietary constraints

`settings` is the household's single row of standing preferences, and the planner treats every
field on it differently depending on how strict a violation would be. Getting that distinction
right — which constraints are a hard "never" and which are a soft "prefer not to" — is the single
most important judgment call in the `plan` action, because it's the one place where getting it
wrong doesn't just produce a worse week, it produces a genuinely unsafe or broken one.

**Diet and allergies are hard filters.** A `settings.diet` of `'vegetarian'`, `'vegan'`,
`'pescatarian'`, or similar excludes a whole category of recipe outright — not "avoid where
possible," but "never slot this, ever, no matter how well it scores on pantry coverage or cuisine
fit." The same is true, even more strictly, for `settings.allergies`: an allergen is a safety
constraint, not a taste preference, and a false negative there (letting an allergen-containing
recipe through) is a categorically worse failure than a false positive (excluding a recipe that
would actually have been fine). When in doubt about whether an ingredient or tag matches an
allergy or diet restriction, exclude the recipe rather than risk it.

**Dislikes, cuisines, and prep time are soft preferences.** `settings.dislikes` should
de-prioritize a recipe, not remove it from consideration entirely — a household that "dislikes"
mushrooms would still rather eat a mushroom risotto than nothing at all if the recipe box is thin
that week. Likewise, `settings.cuisines` is a preference to favor, and `settings.maxPrepMinutes` is
a weeknight time cap to prefer honoring, not a rule that must never be broken when nothing else
fits. Treat these as scoring inputs (rank recipes that respect them higher) rather than as
filters that could zero out the whole candidate list.

Two aspects go deeper: `allergies-and-diets.md` covers how to actually recognize a conflict from a
recipe's tags/ingredients (including cross-contamination caveats and allergen families), and
`household-and-servings.md` covers scaling `plan_meals.servings` to `settings.householdSize` and
applying the `maxPrepMinutes` weeknight cap and `cuisines` preference correctly.

# Household size, servings, and time caps

## Scaling servings to the household, not the recipe's default

Every recipe is written for its own `servings` basis (`recipes.servings`, default 2), but the
household the plan is actually feeding is `settings.householdSize` (default 2 when there's no
settings row at all). `plan_meals.servings` should be set to `settings.householdSize`, not copied
from `recipe.servings` — a recipe written for 4 slotted for a household of 2 still gets
`plan_meals.servings = 2`, and the shopper's `recompute` (via `scaleQuantity`) is what actually
scales each ingredient line's quantity down to match. Getting `plan_meals.servings` right at
slot-time matters because it's the number every downstream shopping calculation trusts — the
planner should never leave it at a recipe's own default when a real household size is known.

## `maxPrepMinutes` is a weeknight cap, applied as a preference

`settings.maxPrepMinutes` describes how much time the household actually has on a typical weeknight
— not a hard cutoff that makes a slower recipe invalid, but a signal that recipes at or under that
threshold should be favored when the choice is otherwise close. In practice this means: when two
candidate recipes have similar pantry-coverage scores, prefer the one with `prepMinutes` at or
under the cap. A single standout recipe that's a little over the cap but otherwise a great fit
(uses up expiring stock, matches every dietary constraint, nothing else comes close) is still a
reasonable pick — the cap steers close calls, it doesn't disqualify.

## `cuisines` favors, it doesn't require

`settings.cuisines` is an array of preferred cuisine strings. A recipe whose `tags` include one of
those cuisines should be favored in scoring, exactly like the prep-time cap — treat it as a
positive weight added on top of the pantry-coverage score, not a filter that removes every recipe
outside the preferred list. A household that prefers Italian and Mexican still wants dinner on a
week where the best-covered recipes happen to be Greek; excluding them entirely because of a
cuisine mismatch would leave good, well-stocked options on the table for no real benefit.

## When `settings` doesn't exist at all

A brand-new household may not have a `settings` row yet (`db.query('settings')[0]` returns
`undefined`). In that case every constraint above falls back to its default: household size 2, no
diet restriction, no allergies, no dislikes, no cuisine preference, and a generous default prep-time
cap (or no cap at all, if none is configured) — the planner should still produce a full week of
dinners rather than stalling because preferences haven't been configured yet.

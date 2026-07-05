# Rotation and repeats

## Avoiding a repeat when the box can support it

When picking a recipe for a given day, check which recipes have already been slotted elsewhere in
the same week's `plan_meals` before settling on a pick that's already been used. If the recipe box
has meaningfully more eligible candidates than there are days left to fill, a repeat is an
avoidable mistake, not a necessary trade-off — prefer the next-best-scoring candidate that hasn't
already been used this week over re-slotting a favorite twice. This matters most for a household
with a healthy, varied recipe box; the smaller the box gets relative to 7 days, the more tolerable
(and eventually unavoidable) repeats become.

## When a repeat is the right call

A recipe box with only 3-4 recipes that satisfy the week's dietary constraints cannot fill 7
distinct dinner slots without repeating something — and forcing an exception to the diet/allergy
filter just to avoid a repeat would be exactly backwards, trading a real safety/preference
violation for a cosmetic one. In that situation, repeating the best-covered, best-rated eligible
recipe multiple times across the week is the correct behavior, not a failure to route around.
Never leave a day unfilled purely to dodge a repeat — an actually-cooked repeated dinner is always
better than an empty plan slot.

## Using ratings to favor winners and retire flops

Recipes accumulate an implicit reputation over time from how the household actually responds to
them (surfaced through whatever rating/feedback mechanism the app exposes on a cooked meal). When
two candidate recipes are otherwise close on pantry coverage and dietary fit, prefer the one with
a track record of being well-received, and de-prioritize — though don't hard-exclude — one that's
been consistently rated poorly. A recipe that's never been cooked yet has no track record either
way and should be scored purely on coverage/fit; a lack of rating history is not itself a strike
against a recipe, since every recipe was new once and the household's box would never grow if
untried recipes were penalized for it.

# Nutrition balance at a planner's level

## What the planner can infer without macro data

`recipes` carries `tags` and a `title`/`description`, but no macro breakdown — that lives in the
`nutrition` space's `nutrition_facts`/`meal_nutrition` tables, computed separately from what the
chef space slots. Without querying across spaces, the planner's read on "balance" has to come from
qualitative signals: a `tags` array containing `'protein'`-adjacent categories (meat, fish, tofu,
legume-based titles), a title suggesting a vegetable-forward dish ("salad", "stir-fry", "roasted
vegetables"), or a cuisine/style tag suggesting a starch-heavy dish (pasta, rice bowl). These are
weak signals, not measurements — treat them as a soft nudge in scoring, similar in spirit to a
cuisine preference, not as something to report back with false precision ("this week is 40%
protein" is not a claim the planner can actually back up from `recipes` data alone).

## Spreading protein type and dish style across the week

When several similarly-scored candidates exist for a day, mildly prefer whichever one differs in
apparent protein source or dish style from what's already been slotted on adjacent days that same
week — a week that's chicken-based every single night is less interesting than one that varies
between chicken, fish, legumes, and a vegetarian night, even holding pantry coverage roughly
constant. This is the same "break a repeat when the box allows it" instinct from
`rotation-and-repeats.md`, just applied to protein type/style instead of the exact same recipe.

## Where the line is

The planner should not attempt to hit a calorie or macro target per day — that's squarely the
`nutrition` space's job (its `nutritionist`/`coach` agents own `nutrition_facts` and
`settings.calorieTarget`/`proteinTarget`). If a household wants the week's dinners actively tuned
to hit a protein target, that's a nutrition-space concern layered on top of a plan the chef has
already slotted, not something to fold into the chef's own scoring logic here. Keep the chef's
"balance" reasoning qualitative and modest — enough to avoid an obviously repetitive week, not a
substitute for real macro tracking.

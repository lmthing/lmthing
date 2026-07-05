---
input:
  planId: string
---

Fill a week of dinners into an existing `meal_plans` row end-to-end: load the recipe box, pantry,
and household settings; score every recipe by how well the pantry already covers it and how well
it fits the household's diet/allergies/dislikes/cuisine/time preferences; slot one dinner per
calendar day of the plan's week in parallel; then mark the plan `ready`. See
`meal-planning/dietary-constraints` for how diet/allergy filtering works as a hard gate and
`meal-planning/variety-and-balance` for how repeats and past ratings should steer the picks.

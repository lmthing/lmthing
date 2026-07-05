---
variable: targetsAndAdherence
description: How calorieTarget/proteinTarget scale with household size, and what counts as meaningfully off-target versus normal day-to-day variation.
---

# Targets and adherence

The household's nutrition goals live in a single `settings` row: `calorieTarget` and
`proteinTarget` are **per person, per day** (defaulting to 2000 kcal and 80g respectively), and
`householdSize` says how many people the plan cooks for. Every place in this app that compares an
actual total against "the target" — the nutritionist's day-flagging step, the coach's weekly
explanation, and the `getPlanNutrition` API's adherence figure — multiplies the two together first:
a household of 4 with the default settings has a whole-household daily target of 8000 kcal and
320g of protein, not 2000 kcal and 80g. Comparing a household-wide total against a per-person target
directly is a common and easy mistake to make; always scale by `householdSize` first.

Whether an actual value counts as "off target" is never a raw equality check — `macroTargetStatus`
classifies a value as `'under'`, `'on-track'`, or `'over'` using a ±25% band around the target, and
treats a missing or non-positive target as `'on-track'` (there's nothing to be off-track from until
the household actually sets a goal). `calorie-protein-targets.md` covers where the default numbers
and that ±25% band come from and what they're meant to represent; `weekly-balance.md` covers how to
read a whole week's pattern rather than reacting to any single day's number in isolation.

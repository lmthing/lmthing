---
variable: varietyAndBalance
description: How to avoid repeat dinners and spread protein/veg across the week when slotting the plan.
---

# Variety and balance

A technically valid week — seven dinners, every one respecting diet and allergies, every one
well-stocked — can still be a bad week if it's the same recipe five nights running, or five nights
of pasta with no vegetable in sight. Coverage score and hard dietary filters get a plan to
"acceptable"; variety and balance are what get it to "actually pleasant to eat." Neither is a hard
constraint the way allergies are — a household with only three recipes that fit their diet this
week is better served by a repeated recipe than an empty dinner slot — but both should visibly
shape which recipe gets picked when there's a real choice.

**Repeats** are the easiest failure to notice and the one worth spending the most effort avoiding
when the recipe box has enough options: no household wants to see the same dinner twice in one
week if there were six other equally-good candidates sitting unused. `rotation-and-repeats.md`
covers how to reason about this concretely, including how the box's actual size changes what
"enough options" means, and how a recipe's own rating history should tip the balance between two
otherwise-similar candidates.

**Nutritional balance across the week** is a softer, harder-to-verify goal at the planner's level
— this app's `recipes` table doesn't carry macro data itself (that's the `nutrition` space's job,
via `nutrition_facts`/`meal_nutrition`), so the planner reasons about balance qualitatively from
tags and titles (protein type, "salad"/"stir-fry"/"soup" style cues) rather than precise numbers.
`nutrition-balance.md` covers what a planner can reasonably infer and act on without that deeper
nutrition data, and where the line is between "this is the planner's job" and "this is the
nutrition space's job."

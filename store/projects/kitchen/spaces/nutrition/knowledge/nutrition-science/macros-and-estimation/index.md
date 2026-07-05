---
variable: macrosAndEstimation
description: How the deterministic per-ingredient nutrition estimate works, what food-family profile it draws from, and where its numbers are honest guesses rather than measurements.
---

# Macros and estimation

Every nutrition number the kitchen app shows — a meal's calories, a recipe's per-serving protein, a
day's macro balance — ultimately traces back to one `nutrition_facts` row per pantry ingredient:
calories, protein, carbohydrate, and fat per one unit of that ingredient (its `unit` column — grams,
milliliters, or a whole "count" item). There is no external nutrition database wired into this app,
no barcode lookup, no USDA API call. Instead, `estimateNutrition` produces a **deterministic,
keyword-based estimate** from an ingredient's name, category, and unit alone, and the nutritionist
persists that estimate the first time it's needed — for a new pantry ingredient, or the first time a
recipe references one nothing has estimated yet.

This is a real trade-off, not an oversight, and it shapes how every downstream number should be
talked about. The estimate is good enough to notice "this week is light on protein" or "this dinner
is very calorie-dense," which is genuinely useful for a household planning meals. It is not good
enough to stand in for a lab-measured nutrition label, and no agent in this space should ever imply
otherwise — every `nutrition_facts` row carries a `basisNote` explaining how it was derived
specifically so that a person (or another agent) reading the number later can see it's an estimate,
not a fact.

Two aspects cover this in more depth. `macro-profiles.md` walks through the small set of food-family
profiles `estimateNutrition` classifies an ingredient into (oils/fats, proteins, grains, dairy,
produce, fruit, sweets, and a generic fallback) and how those per-100g/ml figures were chosen.
`unit-conversion.md` covers how a per-100g/ml profile becomes a per-unit figure — straight scaling
for grams and milliliters, a rough typical-piece weight for `count` — and why that conversion, plus
the recipe-servings-to-slot-servings scaling the nutritionist applies on top of it, compounds the
estimate's coarseness even further.

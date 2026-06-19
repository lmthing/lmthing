---
id: "cook-with-traditional-techniques"
output:
  cookingSteps: "string[]"
  technique: "string"
dependsOn:
  - "prepare-mise-en-place"
optional: false
goal: false
---

Apply the appropriate Greek cooking technique for the dish. Describe the foundational method: for braised dishes use yiahni (soften aromatics in olive oil, layer tomato paste, tomatoes, add meat, simmer low and slow); for vegetable dishes use ladera (generous olive oil, cook until meltingly tender, not stir-fried); for sauces use avgolemono (temper eggs with hot liquid, never boil after); for oven dishes use sto fourno (low and slow with lemon and oregano). Include heat management instructions, when to add wine, and the Greek secret: more olive oil than expected plus fresh lemon at the end.

currentTask.resolve({ cookingSteps: ["ordered list of cooking instructions"], technique: "primary technique name" });

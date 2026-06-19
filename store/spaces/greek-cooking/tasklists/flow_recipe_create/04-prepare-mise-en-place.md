---
id: "prepare-mise-en-place"
output:
  miseEnPlace: "string[]"
dependsOn:
  - "gather-ingredients"
optional: false
goal: false
---

Provide detailed mise en place instructions for the recipe: cutting techniques (how to dice onions, slice eggplant consistently, mince garlic at the last minute, chop herbs roughly for rustic texture), any pre-cooking steps (salt eggplant and rest 30 minutes, soak dried beans overnight, bring meat to room temperature, drain and crumble feta), and how to organize the cooking station by grouping ingredients by cooking stage with vessels and serving dishes prepared in advance.

currentTask.resolve({ miseEnPlace: ["ordered list of preparation steps"] });

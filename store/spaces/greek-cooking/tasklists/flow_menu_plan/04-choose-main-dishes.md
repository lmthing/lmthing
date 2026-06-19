---
id: "choose-main-dishes"
output:
  mainDishes: "string[]"
dependsOn:
  - "select-meze-course"
optional: false
goal: false
---

Based on the occasion, dietary needs, and season, select the main courses. Choose at least one protein-heavy main (lamb, pork, chicken, or seafood as appropriate) and one vegetarian or grain-based option for larger or mixed groups. Match the mains to the occasion (e.g. lamb for Easter, light seafood for summer). Explain the rationale for each choice.

currentTask.resolve({ mainDishes: ["list of main dish names"] });

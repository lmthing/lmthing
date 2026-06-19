---
id: "select-dish-category"
output:
  dishCategory: "string"
  servings: "string"
dependsOn: []
optional: false
goal: false
---

Ask the user what type of Greek dish they want to create. Present the main categories: Meze (small sharing plates — dips, cheese, olives), Soups (avgolemono, fasolada, trachanas), Main Courses (moussaka, pastitsio, grilled meats), Seafood (fresh fish, octopus, shrimp saganaki), Vegetarian Ladera (olive oil-based vegetable dishes), Pies (spanakopita, tiropita, regional variations), or Desserts (baklava, galaktoboureko, kourabiedes). Also confirm the number of servings and the occasion.

currentTask.resolve({ dishCategory: "selected category as a string", servings: "number of servings as a string" });

---
id: "gather-ingredients"
output:
  ingredients: "string[]"
  substitutions: "string[]"
dependsOn:
  - "choose-region-and-style"
optional: false
goal: false
---

Based on the dish category and region, produce a complete ingredient list. Always anchor the pantry around authentic Greek staples: extra virgin Greek olive oil (koroneiki variety), PDO feta from sheep/goat milk, fresh herbs (oregano/rigani, dill, mint, parsley), and spices (cinnamon, allspice, bay leaves). List fresh produce, aromatics, and proteins appropriate to the dish. For each non-Greek ingredient that may be hard to source, provide an authentic substitution note.

currentTask.resolve({ ingredients: ["complete list of ingredients with quantities"], substitutions: ["substitution notes as strings"] });

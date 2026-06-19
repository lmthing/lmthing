---
id: "plate-and-serve"
output:
  recipe: "object"
dependsOn:
  - "season-and-adjust"
optional: false
goal: true
---

Describe how to plate and serve the dish in authentic Greek style. Use family-style service on shared platters rather than individual plating. Present on simple white or terracotta dishes with a generous drizzle of olive oil on top, fresh herbs as garnish (to be eaten, not merely decorative), and lemon wedges on the side. Specify the correct serving temperature (many Greek dishes are served at room temperature; ladera should not be piping hot; grilled items served immediately). List the natural accompaniments (Greek salad, tzatziki or yogurt, Kalamata olives, fresh bread for sopping sauces). Compile the complete recipe into a single formatted recipe card.

currentTask.resolve({ recipe: { title: "dish name", region: region, style: style, servings: servings, ingredients: ingredients, steps: cookingSteps, seasoningNotes: seasoningNotes, plating: "plating instructions as a string" } });

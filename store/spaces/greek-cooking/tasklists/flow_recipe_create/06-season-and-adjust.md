---
id: "season-and-adjust"
output:
  seasoningNotes: "string[]"
dependsOn:
  - "cook-with-traditional-techniques"
optional: false
goal: false
---

Guide the user through final seasoning and adjustment. Instruct them to: taste throughout cooking rather than only at the end; check salt levels carefully after adding feta or olives (which contribute salt); balance acidity with sweetness if needed; add coarse sea salt in layers; finish with fresh lemon juice for brightness; add fresh herbs (dill, mint, parsley) at the very end; add dried oregano during cooking; remove bay leaves before serving; finish with a drizzle of fresh extra virgin olive oil and cracked pepper. Let flavors meld a few minutes before tasting the final balance.

currentTask.resolve({ seasoningNotes: ["list of final seasoning adjustments made"] });

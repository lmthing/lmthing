---
id: "select-meze-course"
output:
  mezeCold: "string[]"
  mezeHot: "string[]"
dependsOn:
  - "set-guest-parameters"
optional: false
goal: false
---

Using the occasion, guest count, and dietary needs from previous steps, select an appropriate meze selection. Always include the essentials (feta block, Kalamata olives, crusty bread). Choose 2-3 cold meze and 1-2 hot meze appropriate to the dietary constraints and occasion. Explain timing: meze should be served immediately on guest arrival.

currentTask.resolve({ mezeCold: ["list of cold meze selected"], mezeHot: ["list of hot meze selected"] });

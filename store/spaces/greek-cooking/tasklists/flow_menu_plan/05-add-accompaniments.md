---
id: "add-accompaniments"
output:
  salads: "string[]"
  starches: "string[]"
dependsOn:
  - "choose-main-dishes"
optional: false
goal: false
---

Select the accompaniments that will complete the menu: the essential Greek salad (horiatiki — tomatoes, cucumber, onion, feta, olives, no lettuce), additional salads if needed, starch sides (lemon potatoes, rice pilaf, orzo), and bread. Match sides to the main dishes chosen. Remind the user that Greeks always over-provide and leftovers are expected and welcomed.

currentTask.resolve({ salads: ["list of salads"], starches: ["list of starch sides"] });

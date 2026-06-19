---
id: "plan-desserts"
output:
  desserts: "string[]"
dependsOn:
  - "add-accompaniments"
optional: false
goal: false
---

Select desserts appropriate to the occasion and dietary needs. For celebrations choose syrup-soaked sweets (baklava, galaktoboureko). For holiday occasions include required traditional sweets (vasilopita for New Year, tsoureki for Easter). Always offer a lighter fresh fruit option alongside richer desserts. Advise serving with Greek coffee.

currentTask.resolve({ desserts: ["list of desserts chosen"] });

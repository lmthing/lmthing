---
id: "choose-region-and-style"
output:
  region: "string"
  style: "string"
dependsOn:
  - "select-dish-category"
optional: false
goal: false
---

Based on the dish category, help the user choose the regional style. Present the mainland regions (Athens/Attica, Thessaloniki with Ottoman influence, Peloponnese rustic, Epirus mountain pies/dairy), island regions (Crete with wild greens and distinct olive oil; Cyclades fresh seafood and local cheeses; Dodecanese Eastern Mediterranean; Ionian Islands with Italian influences), and whether they want a traditional or modern interpretation. Recommend a region that suits their dish category.

currentTask.resolve({ region: "selected region as a string", style: "traditional or modern" });

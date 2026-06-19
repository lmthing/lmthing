---
id: "create-cooking-timeline"
output:
  timeline: "string"
  fullMenu: "object"
dependsOn:
  - "plan-desserts"
optional: false
goal: true
---

Create a detailed cooking timeline working backwards from the intended serving time. Organize tasks across: the day before (shopping, dips, dolmades, marinating meat, baking desserts), morning of (vegetable prep, slow-cooking starts, set the table), 2 hours before (oven dishes, salad prep, arrange cold meze), 1 hour before (rice/pasta, hot meze, grilling), and 30 minutes before (dress salads, final seasoning, pour drinks). Compile the complete menu plan with all courses and the full timeline into a single formatted response.

currentTask.resolve({ timeline: "full timeline as a markdown string", fullMenu: { meze: mezeCold.concat(mezeHot), mains: mainDishes, sides: salads.concat(starches), desserts: desserts } });

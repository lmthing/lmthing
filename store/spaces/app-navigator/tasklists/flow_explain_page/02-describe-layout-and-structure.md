---
id: describe-layout-and-structure
output:
  layoutPattern: string
  layoutDescription: string
dependsOn:
  - identify-the-page
optional: false
goal: false
---

Based on the page identified in the previous step, describe its overall layout pattern:

- **L1 – Single-Column Centered** (Home Page): Centered column, hero → CTA → grid. Framed with a soft glowing border.
- **L2 – Three-Column Dashboard** (Studio Dashboard, Agent Config): Left sidebar (fixed) + center content (flexible) + optional right action panel.
- **L3 – Two-Column Split** (Knowledge Area Details): Sidebar + tree file explorer (left half) + markdown editor (right half).

Name the layout pattern used and explain why it suits the content on that page. Reference how the columns interact and what each region is responsible for.

currentTask.resolve({ layoutPattern: "<L1|L2|L3 — name>", layoutDescription: "<explanation of layout choice>" });

---
id: highlight-interactive-elements
output:
  interactiveElements: string[]
  summary: string
dependsOn:
  - walk-through-user-stories
optional: false
goal: true
---

For the selected page, summarize all interactive elements grouped by what they trigger:

**Modal-triggering actions** — buttons and links that open overlay dialogs
**Navigation actions** — clicks that route to another page
**Toggle/Panel actions** — controls that show/hide panels, toggle states, or expand/collapse sections
**Contextual menus** — hover-reveal menus per item (three-dot menus, action cards)
**Editor and Chat** — in-place editors and overlay chat surfaces

For each interaction, explain how it is visually signalled (hover shadows, color changes, icon transitions, badge state changes). Reference component codes (C1–C10) for precision.

Conclude with a one-paragraph synthesis of the page's interactive model and the key interaction patterns a user should know.

currentTask.resolve({ interactiveElements: ["<element: trigger → result>", "..."], summary: "<synthesis paragraph>" });

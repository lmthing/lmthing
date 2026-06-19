---
id: "set-guest-parameters"
output:
  guestCount: "string"
  dietaryNeeds: "string[]"
dependsOn:
  - "define-the-occasion"
optional: false
goal: false
---

Based on the occasion identified in the previous step, ask the user about their guest parameters: how many guests are expected, whether any guests have dietary restrictions (Orthodox fasting, vegetarian, nut-free, gluten-free, dairy-free), and the available cooking capacity and budget. Summarize the constraints that will shape the menu.

currentTask.resolve({ guestCount: "number of guests as a string", dietaryNeeds: ["array of dietary restriction strings"] });

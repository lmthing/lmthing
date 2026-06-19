---
id: "define-the-occasion"
output:
  occasion: "string"
dependsOn: []
optional: false
goal: false
---

Ask the user what kind of occasion they are planning the Greek menu for. Identify whether it is everyday dining, a Sunday family lunch, a name day or birthday, Easter, Christmas or New Year, or a summer gathering. Use their answer to determine the overall tone, number of courses, and complexity of the menu.

currentTask.resolve({ occasion: "the occasion type as a string" });

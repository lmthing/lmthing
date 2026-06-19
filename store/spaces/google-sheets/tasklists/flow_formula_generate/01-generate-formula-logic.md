---
id: "generate-formula-logic"
output:
  problemSummary: "string"
  logicalSteps: "string[]"
  functionsRequired: "string[]"
  complexity: "string"
  approach: "string"
dependsOn: []
optional: false
goal: false
---

Analyze the user's spreadsheet problem and design the core formula logic. Break down the problem into logical steps, identify which Google Sheets functions are needed (VLOOKUP, INDEX/MATCH, ARRAYFORMULA, QUERY, etc.), determine if nested functions or helper columns are required, and outline the data flow from input cells to output. Consider the user's data size and sheet structure from the knowledge context.

currentTask.resolve({
  problemSummary: "...",
  logicalSteps: ["..."],
  functionsRequired: ["..."],
  complexity: "moderate",
  approach: "..."
});

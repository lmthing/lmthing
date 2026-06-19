---
id: "generate-syntax-and-implementation"
output:
  primaryFormula: "string"
  formulaBreakdown: "object[]"
  helperFormulas: "object[]"
  implementationNotes: "string[]"
dependsOn:
  - "generate-formula-logic"
optional: false
goal: false
---

Based on the formula logic from the previous step, generate the exact Google Sheets formula syntax. Provide the complete formula with placeholder cell references the user can adapt, explain each nested function and its role, note whether ARRAYFORMULA wrapping is needed for range operations, and include any required helper formulas for intermediate calculations. Use proper Google Sheets syntax (not Excel).

currentTask.resolve({
  primaryFormula: "=IFERROR(VLOOKUP(A2, DataSheet!$A:$C, 2, FALSE), \"\")",
  formulaBreakdown: [
    { segment: "VLOOKUP(A2, DataSheet!$A:$C, 2, FALSE)", explanation: "Looks up value in A2 across columns A–C of DataSheet, returns column 2" }
  ],
  helperFormulas: [],
  implementationNotes: ["Replace A2 with your lookup key cell", "Adjust range DataSheet!$A:$C to match your actual sheet name and columns"]
});

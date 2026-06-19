---
id: "generate-example-usage"
output:
  sampleData: "object[]"
  appliedFormula: "string"
  expectedResults: "object[]"
  walkthrough: "string"
dependsOn:
  - "generate-error-handling"
optional: false
goal: true
---

Create a concrete example demonstrating the final error-handled formula with realistic sample data. Generate 3–5 rows of sample data relevant to the user's industry and task purpose (from knowledge context), show the formula applied with actual cell references, display the expected output for each row, and provide a step-by-step walkthrough of how the formula processes one example row.

currentTask.resolve({
  sampleData: [
    { "A": "INV-001", "B": "Widget A", "C": 49.99 },
    { "A": "INV-002", "B": "Widget B", "C": 19.99 },
    { "A": "", "B": "", "C": "" }
  ],
  appliedFormula: "=IFERROR(IF(ISBLANK(A2), \"\", VLOOKUP(A2, DataSheet!$A:$C, 2, FALSE)), \"Not found\")",
  expectedResults: [
    { row: 2, result: "Widget A", explanation: "INV-001 found in DataSheet, returns column B value" },
    { row: 3, result: "Widget B", explanation: "INV-002 found, returns Widget B" },
    { row: 4, result: "", explanation: "A4 is blank, ISBLANK guard returns empty string" }
  ],
  walkthrough: "For row 2: ISBLANK(A2) is FALSE (A2='INV-001'), so VLOOKUP runs. It scans DataSheet column A for 'INV-001', finds it in row 1, and returns column 2 value 'Widget A'. IFERROR catches any unexpected errors and shows 'Not found' instead."
});

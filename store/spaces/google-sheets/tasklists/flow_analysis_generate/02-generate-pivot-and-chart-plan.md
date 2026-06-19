---
id: "generate-pivot-and-chart-plan"
output:
  pivotConfig: "object"
  chartRecommendations: "object[]"
  formulaSummary: "string[]"
dependsOn:
  - "assess-data-profile"
optional: false
goal: false
---

Based on the data profile, design the pivot table configuration and chart recommendations. Specify the pivot table rows, columns, and value aggregation. Recommend 1–3 chart types (bar, line, pie, scatter) suited to the data categories and task, explaining why each chart type fits. List any summary formulas (SUMIF, COUNTIF, AVERAGEIF, QUERY) that complement the pivot analysis.

currentTask.resolve({
  pivotConfig: {
    rows: ["Category"],
    columns: ["Month"],
    values: [{ field: "Amount", aggregation: "SUM" }]
  },
  chartRecommendations: [
    { type: "Column chart", rationale: "Compares totals across categories at a glance" },
    { type: "Line chart", rationale: "Shows trends over time for the selected metric" }
  ],
  formulaSummary: ["=SUMIF(B:B, \"Category\", C:C)", "=COUNTIF(D:D, \">0\")"]
});

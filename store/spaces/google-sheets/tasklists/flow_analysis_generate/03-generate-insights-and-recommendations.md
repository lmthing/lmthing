---
id: "generate-insights-and-recommendations"
output:
  insights: "string[]"
  actionableRecommendations: "string[]"
  cleaningSteps: "string[]"
  summary: "string"
dependsOn:
  - "generate-pivot-and-chart-plan"
optional: false
goal: true
---

Synthesize the analysis plan into concrete insights and actionable recommendations. Identify 3–5 key findings the user should expect to see in their data based on their task purpose and data categories. Recommend next steps (e.g., data cleaning with TRIM/CLEAN, additional columns to compute, conditional formatting to add). Provide a concise summary the user can share with stakeholders.

currentTask.resolve({
  insights: [
    "Top-performing category likely accounts for a disproportionate share of total value",
    "Blank or inconsistently formatted entries in key columns may skew aggregations",
    "Trend over time will reveal seasonality or growth patterns"
  ],
  actionableRecommendations: [
    "Apply TRIM() to text columns before aggregating to avoid mismatches",
    "Add a calculated column for % of total using =C2/SUM($C:$C)",
    "Use conditional formatting to highlight top 10% values in the metric column"
  ],
  cleaningSteps: ["=TRIM(B2) to standardize category names", "=PROPER(A2) for consistent capitalization"],
  summary: "The analysis reveals key distribution patterns across your data categories. After cleaning and pivoting, you can identify top contributors and track trends over time."
});

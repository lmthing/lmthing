---
id: "assess-data-profile"
output:
  dataProfile: "string"
  keyColumns: "string[]"
  suggestedMetrics: "string[]"
  analysisApproach: "string"
dependsOn: []
optional: false
goal: false
---

Assess the user's spreadsheet data based on their task purpose and data categories from the knowledge context. Identify the key columns most relevant to the analysis goal, propose the primary metrics to compute (counts, sums, averages, percentages), and choose an analysis approach (summary stats, trend analysis, segmentation, comparison). Take into account the user's industry and task purpose.

currentTask.resolve({
  dataProfile: "...",
  keyColumns: ["..."],
  suggestedMetrics: ["..."],
  analysisApproach: "..."
});

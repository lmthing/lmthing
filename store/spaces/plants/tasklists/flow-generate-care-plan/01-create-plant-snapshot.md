---
id: create-plant-snapshot
output:
  snapshot: object
dependsOn: []
optional: false
goal: false
---

Review the plant profile (type: {{plantType}}, growth stage: {{growthStage}}) and any reported symptoms. Summarize the current plant status into a concise snapshot, assessing overall risk level as "low", "medium", or "high".

currentTask.resolve({
  snapshot: {
    plantType: <identified plant type>,
    growthStage: <identified growth stage>,
    riskLevel: <"low" | "medium" | "high">
  }
});

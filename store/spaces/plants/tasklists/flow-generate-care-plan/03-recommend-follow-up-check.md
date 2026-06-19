---
id: recommend-follow-up-check
output:
  followUpPlan: object
dependsOn:
  - generate-weekly-actions
optional: false
goal: true
---

Based on the plant snapshot and the generated weekly care actions, recommend when the user should reassess the plant's health and what specific symptoms or changes to observe. Include timing for the first check-in, warning signs that require immediate action, and positive indicators that the care plan is working.

currentTask.resolve({
  followUpPlan: {
    firstCheckIn: <e.g. "3 days" or "1 week">,
    observationPoints: [<specific thing to observe>, ...],
    warningSignals: [<symptom requiring immediate action>, ...],
    positiveIndicators: [<sign the care plan is working>, ...]
  }
});

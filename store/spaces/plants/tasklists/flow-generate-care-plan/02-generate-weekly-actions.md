---
id: generate-weekly-actions
output:
  weeklyActions: object
dependsOn:
  - create-plant-snapshot
optional: false
goal: false
---

Using the plant snapshot from the previous step, generate a practical one-week care action list tailored to the plant's type, growth stage, and risk level. Each action must specify the day of the week, the specific task to perform, and the reason it is needed. Keep the plan safe and low-maintenance.

currentTask.resolve({
  weeklyActions: {
    actions: [
      { day: <day name>, task: <care task description>, reason: <why this task matters> },
      ...
    ]
  }
});

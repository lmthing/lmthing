---
id: generate-weekly-training-schedule
output:
  weeklySchedule: string
dependsOn: []
optional: false
goal: false
---

Using the loaded knowledge (breed type, age, experience level, living environment) and user inputs, generate a personalized weekly training schedule for the dog. Assign specific skills to each day of the week with session duration, repetition counts, and progression criteria. Balance new skill introduction with review of previously learned commands. Include rest days and socialization time. Adapt intensity to the dog's energy level and attention span.

currentTask.resolve({ weeklySchedule: "string" })

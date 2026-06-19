---
id: generate-reward-recommendations
output:
  rewardStrategy: string
dependsOn:
  - generate-weekly-training-schedule
optional: false
goal: false
---

Using the weekly schedule produced in the previous step and the loaded knowledge about breed type and dog traits, generate a personalized reward strategy. Create a tiered reward system: high-value treats for new or difficult skills, low-value treats for reinforcing known commands, and non-food rewards (verbal praise, petting, favorite toy). Include timing guidance for reward delivery (mark within 1-2 seconds), fading schedules for transitioning from continuous to intermittent reinforcement, and portion management to avoid overfeeding during training sessions.

currentTask.resolve({ rewardStrategy: "string" })

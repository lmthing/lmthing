---
id: generate-behavioral-support-guide
output:
  behavioralGuide: string
dependsOn:
  - generate-reward-recommendations
optional: false
goal: true
---

Using the weekly schedule and reward strategy from the previous steps, plus the loaded knowledge about breed type and living environment, generate a behavioral support guide addressing common issues for this dog. Cover typical behavioral challenges (excessive barking, leash pulling, jumping, separation anxiety, resource guarding, leash reactivity) with positive reinforcement-based solutions. For each issue, provide root cause analysis, prevention strategies, step-by-step correction techniques, expected timeline for improvement, and when to seek professional help. Tailor recommendations to the dog's breed tendencies and living environment.

currentTask.resolve({ behavioralGuide: "string" })

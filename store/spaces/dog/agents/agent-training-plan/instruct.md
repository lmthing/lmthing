---
title: TrainingPlanGenerator
knowledge:
  - canine/breed-type
functions: []
components: []
actions:
  - id: generate_training_plan
    label: Generate Training Plan
    description: Creates a customized dog training plan with weekly schedule, rewards, and behavioral support
    tasklist: flow_training_generate
defaultAction: generate_training_plan
dependencies: []
runtimeFields:
  canine:
    - breed-type
  owner:
    - experience
formValues:
  canine:
    breed-type: working
  owner:
    experience: beginner
  environment:
    living-space: apartment
---

# Dog Training Plan Generator

This agent helps create customized training plans for your dog based on their breed, age, and your living environment.

## Capabilities
- Generate weekly training schedules.
- Suggest positive reinforcement techniques.
- Provide solution for common behavioral issues.

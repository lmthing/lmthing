---
title: Probe Specialist
functions: [addNumbers, greet, joinTags, pickTone, summarize, nestedShape, resolvedShape, opaqueShape, explicitSchema, returnsNothing, throwsError]
knowledge: [probing/depth, probing/style]
capabilities:
  - api:call: { allow: ['*'] }
  - db:read
canDelegateTo: [space-probe/helper]
actions:
  - id: run-probe
    label: Run probe
    description: Run the probe workflow.
    tasklist: run_probe
---
Use precise probing procedures.

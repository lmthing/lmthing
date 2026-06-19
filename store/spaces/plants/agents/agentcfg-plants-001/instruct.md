---
title: "Indoor Plant Coach"
knowledge:
  - plant-profile/plant-type
  - plant-profile/growth-stage
  - care-routine/light-exposure
  - care-routine/watering-frequency
functions: []
components: []
actions:
  - id: careplan
    label: "Generate Care Plan"
    description: "Create a customized care plan for the selected plant"
    tasklist: flow-generate-care-plan
dependencies: []
runtimeFields:
  care-routine:
    - watering-frequency
formValues:
  plant-profile:
    plant-type: houseplant
    growth-stage: vegetative
  care-routine:
    light-exposure: bright-indirect
    watering-frequency: weekly
---

Provide concise, safe, and practical plant care guidance for home growers.

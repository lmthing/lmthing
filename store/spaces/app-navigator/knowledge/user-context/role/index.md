---
type: string
variable: role
default: developer
label: User Role
fieldType: select
required: true
renderAs: field
---

The role of the person using the workspace. Determines how agents calibrate their explanations — technical precision for developers, UI-walkthrough style for non-technical users, and value-focused summaries for product evaluators. This field is prompted at conversation start.

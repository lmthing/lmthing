---
title: Flow IDs
description: Naming rules for flow identifiers and folder names
order: 3
---

# Flow IDs

Flow folders use `flow_` prefix followed by **snake_case** — lowercase words separated by underscores.

## Rules

- Always start with `flow_` prefix
- Body uses snake_case — lowercase with underscores
- Should describe the action the flow performs
- Must match the `flowId` value in the agent's `<slash_action>` tag

## Examples

| Good | Bad | Why |
|------|-----|-----|
| `flow_create_space` | `flow-create-space` | Must use underscores, not hyphens |
| `flow_design_knowledge` | `FlowDesignKnowledge` | Not snake_case |
| `flow_generate_report` | `flow_Generate_Report` | Must be lowercase |

## The flowId Connection

The flow folder name IS the flowId. When an agent's `instruct.md` references a flow:

```xml
<slash_action name="Create Space" description="..." flowId="flow_create_space">
/create
</slash_action>
```

The `flowId="flow_create_space"` must exactly match the folder `flows/flow_create_space/`.

## Step File Names

Inside a flow folder, step files use a different convention:
- Numbered prefix: `1.`, `2.`, `3.`, etc.
- Title Case with spaces: `1.Define Your Subject.md`
- The filename becomes the step's display name (minus the number prefix)

## Guidelines

- Flow names should be verb-first: `flow_create_*`, `flow_design_*`, `flow_review_*`
- Keep flow names under 4 words (excluding the `flow_` prefix)

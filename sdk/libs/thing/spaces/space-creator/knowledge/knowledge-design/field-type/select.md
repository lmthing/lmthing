---
title: Select
description: Single-choice field — the user picks exactly one option from a list
order: 1
---

# Select Field Type

The most common field type. Presents the user with a list of options and requires exactly one selection.

## When to Use

- The agent needs to know one specific thing (e.g., the user's role, the output format)
- The options are mutually exclusive — picking one means the others don't apply
- You want to constrain the agent's behavior to a known set of modes

## Configuration

```json
{
  "label": "Output Format",
  "fieldType": "select",
  "required": false,
  "default": "markdown",
  "variableName": "outputFormat",
  "renderAs": "field"
}
```

## Best Practices

- **3-5 options** is the sweet spot — fewer feels limiting, more causes decision fatigue
- Always set a sensible `default` so casual users can skip the field
- Use `required: true` only when the agent genuinely cannot function without this choice
- Each option's markdown content should be substantive enough to meaningfully change agent behavior
- Option slugs should be short and descriptive (e.g., `markdown`, `json`, `plain-text`)

## Example Use Cases

- Experience level: beginner, intermediate, advanced
- Tone: formal, casual, technical
- Agent pattern: specialist, coordinator, reviewer

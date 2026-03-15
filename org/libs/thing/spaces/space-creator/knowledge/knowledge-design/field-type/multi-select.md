---
title: Multi-Select
description: Multiple-choice field — the user picks one or more options from a list
order: 2
---

# Multi-Select Field Type

Allows the user to select multiple options simultaneously. The agent receives all selected options as context.

## When to Use

- Multiple options can be true at the same time (e.g., selected topics, enabled features)
- You want the agent to consider a combination of perspectives
- The knowledge is additive — more selections mean richer context, not conflicting instructions

## Configuration

```json
{
  "label": "Topics",
  "fieldType": "multiSelect",
  "required": false,
  "default": "fundamentals",
  "variableName": "topics",
  "renderAs": "field"
}
```

## Best Practices

- Keep options independent — selecting option A should not contradict option B
- Write option content that works both alone and in combination with other options
- The `default` value applies when the user makes no selection
- Consider whether a select field with composite options might be simpler
- 4-8 options works well — more than that and users struggle to evaluate combinations

## Example Use Cases

- Knowledge domains to include: fundamentals, advanced-patterns, best-practices
- Target platforms: web, mobile, desktop
- Review criteria: security, performance, readability, maintainability

## Considerations

Multi-select fields inject more context into the agent's prompt. If each option is long, selecting many options could create a very large prompt. Keep individual option content focused.

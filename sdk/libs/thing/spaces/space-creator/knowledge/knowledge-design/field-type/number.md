---
title: Number
description: Numeric field — the user provides a numeric value for quantitative parameters
order: 4
---

# Number Field Type

A numeric input field for quantitative values. The value is injected into the agent's context as a number.

## When to Use

- The parameter is inherently numeric (e.g., count, limit, threshold)
- You need the agent to use a specific quantity in its output
- The value varies per session and can't be captured by predefined options

## Configuration

```json
{
  "label": "Max Items",
  "fieldType": "number",
  "required": false,
  "default": "5",
  "variableName": "maxItems",
  "renderAs": "field"
}
```

## Best Practices

- Set a reasonable `default` so the agent works without user input
- Reference the variable in instructions: "Generate up to {maxItems} suggestions"
- Like text fields, number fields don't have option markdown files
- Use the label to indicate expected range (e.g., "Steps (2-10)" instead of just "Steps")
- Prefer select fields with named ranges when exact numbers don't matter (e.g., "short/medium/long" instead of word count)

## Example Use Cases

- Number of results to generate
- Difficulty level (1-10)
- Word count target
- Number of steps in a flow

## Considerations

Number fields provide minimal context compared to select fields with rich option content. Use them only when the exact numeric value matters more than descriptive guidance.

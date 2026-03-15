---
title: Text
description: Free-text field — the user types a custom value instead of selecting from options
order: 3
---

# Text Field Type

A free-form input where the user types their own value. No predefined options — the value is injected directly into the agent's context via the variable name.

## When to Use

- The value is unique to each user or session (e.g., company name, project title)
- Predefined options would be impractical — too many possibilities
- You want the agent to reference a specific user-provided term throughout the conversation

## Configuration

```json
{
  "label": "Company Name",
  "fieldType": "text",
  "required": true,
  "default": "",
  "variableName": "companyName",
  "renderAs": "field"
}
```

## Best Practices

- Use descriptive labels that make clear what the user should type
- Set `required: true` when the agent's output would be meaningless without this value
- Default to empty string — pre-filled text fields can confuse users
- Reference the `variableName` in agent instructions: "Address the user's company by name using {companyName}"
- Text fields don't have option markdown files — the user's input is the value

## Example Use Cases

- User's name or company name
- Project title or description
- Custom topic or subject not covered by predefined options

## Considerations

Text fields provide no guardrails — the user can type anything. If you need to constrain input to known values, use a select field instead. Text fields also don't contribute rich knowledge content like option files do.

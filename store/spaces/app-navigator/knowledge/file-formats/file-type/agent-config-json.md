---
title: Agent config.json
description: Declares which knowledge fields should be prompted at runtime
order: 3
---

# Agent `config.json` — Runtime Field Declarations

Located at `agents/agent-{slug}/config.json`. This file tells the platform which knowledge fields should be left empty and prompted from the user at conversation start.

## Full Schema

```json
{
  "runtimeFields": {
    "{domain-folder-name}": ["{field-folder-name}", "{field-folder-name-2}"],
    "{domain-folder-name-2}": ["{field-folder-name}"]
  }
}
```

## Field Reference

| Key             | Type     | Rules                                                             |
| --------------- | -------- | ----------------------------------------------------------------- |
| `runtimeFields` | object   | Top-level key. Map of domain → fields.                            |
| Domain key      | string   | Must match the **folder name** inside `knowledge/` exactly        |
| Field array     | string[] | Each string must match a **field folder name** inside that domain |

## Behavior

When a field is listed here:

1. The agent starts without that field's value filled
2. The platform prompts the user to fill it before the conversation begins
3. The user's input is saved to `values.json` for the session

## Examples

**Minimal — prompt user for their role:**

```json
{
  "runtimeFields": {
    "user-context": ["role"]
  }
}
```

**Multiple domains and fields:**

```json
{
  "runtimeFields": {
    "user-profile": ["name", "experience-level"],
    "project": ["goal", "deadline"],
    "content-preferences": ["tone"]
  }
}
```

**No runtime fields (pre-filled defaults only):**

```json
{
  "runtimeFields": {}
}
```

## Validation

- ✅ Valid JSON (no trailing commas, proper quoting)
- ✅ All domain keys match existing `knowledge/{domain}` folder names
- ✅ All field values match existing `knowledge/{domain}/{field}` folder names
- ✅ Only fields with `fieldType: "select"` or `"text"` should be listed
- ✅ Only list fields that genuinely need user input per session

## When to Use Runtime Fields

Use runtime fields when the value:

- Changes per user (e.g., name, role, experience level)
- Changes per session or task (e.g., current project, today's goal)
- Cannot be meaningfully defaulted (e.g., specific user question)

**Avoid** making every field a runtime field — it creates friction. Pre-fill stable defaults and only prompt for what truly varies.

---
title: Package JSON
description: The root manifest file that identifies and configures a space
order: 4
---

# Package JSON

Every space has a `package.json` at its root. This is the space's identity document — it tells the system (and other developers) what this space is.

## Schema

```json
{
  "name": "space-slug",
  "version": "1.0.0",
  "private": true
}
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | The space's slug identifier. Must be kebab-case, match the folder name |
| `version` | Yes | Semantic version. Start with `1.0.0` |
| `private` | Yes | Always `true` for spaces |

## Guidelines

- The `name` field should match the space's folder name exactly
- Keep it minimal — spaces don't need dependencies, scripts, or other npm fields
- Version bumps are optional but useful for tracking major changes to the space's structure
- This file is what the system uses to recognize a directory as a valid space

---
title: package.json
description: The workspace manifest file that identifies a demo workspace
order: 1
---

# `package.json` — Workspace Manifest

Every workspace needs exactly one `package.json` at the root of the workspace folder.

## Full Schema

```json
{
  "name": "{subject-slug}-demo",
  "version": "1.0.0",
  "private": true
}
```

## Field Reference

| Field | Type | Rules |
|---|---|---|
| `name` | string | `{subject-slug}-demo` format. Subject slug must be `kebab-case`. |
| `version` | string | Use `"1.0.0"` always for demo workspaces |
| `private` | boolean | Always `true` — prevents accidental npm publish |

## Example Variants

```json
{ "name": "education-demo", "version": "1.0.0", "private": true }
{ "name": "customer-support-demo", "version": "1.0.0", "private": true }
{ "name": "recipe-manager-demo", "version": "1.0.0", "private": true }
```

## Location

```
app/src/demos/{subject-slug}/package.json
```

## Validation

- ✅ All three fields present
- ✅ `name` ends with `-demo`
- ✅ `name` uses only lowercase letters, numbers, and hyphens
- ✅ `private` is boolean `true` (not string `"true"`)
- ✅ No trailing commas anywhere in the JSON

---
title: Field config.json
description: The metadata file for a knowledge field sub-folder
order: 5
---

# Field `config.json` — Knowledge Field Metadata

Located at `knowledge/{domain}/{field-name}/config.json`. Defines the type and behavior of a knowledge dimension.

## Full Schema

```json
{
  "label": "{Human-Readable Field Name}",
  "description": "{What this field represents}",
  "fieldType": "select",
  "required": true,
  "default": "{option-slug}",
  "variableName": "{camelCaseVariable}",
  "renderAs": "field"
}
```

## Field Reference

| Field | Type | Rules |
|---|---|---|
| `label` | string | Human-readable, Title Case, ~2-4 words |
| `description` | string | One sentence — what this dimension decides |
| `fieldType` | string | `"select"` \| `"multiSelect"` \| `"text"` |
| `required` | boolean | `true` = blocks conversation until filled |
| `default` | string | Filename slug (without `.md`) of the default option |
| `variableName` | string | `camelCase`, unique within the domain |
| `renderAs` | string | Always `"field"` |

## `fieldType` Deep Dive

### `"select"` — Single Choice
- User picks exactly one option from the dropdown
- `default` must point to an existing option file slug
- Best for: experience level, format type, one primary role

```json
{ "fieldType": "select", "default": "intermediate", "variableName": "experienceLevel" }
```

### `"multiSelect"` — Multiple Choices
- User can pick one or more options simultaneously
- `default` should point to the most commonly-needed option
- Best for: topics covered, tools used, goals, tags

```json
{ "fieldType": "multiSelect", "default": "react", "variableName": "techStack" }
```

### `"text"` — Free-form Input
- User types any text; no option `.md` files needed
- Do NOT create option files for text fields
- Best for: user's name, project title, specific question

```json
{ "fieldType": "text", "required": true, "variableName": "userName" }
```
Note: `default` and option files are omitted for `text` type.

## Validation

- ✅ `renderAs` is exactly `"field"` (lowercase)
- ✅ `fieldType` is one of the three valid strings
- ✅ `default` matches an existing option file slug (for select/multiSelect)
- ✅ `variableName` is unique across all fields in the domain
- ✅ `variableName` is `camelCase` with no hyphens or underscores
- ✅ `required: true` only for fields that genuinely must be filled
- ✅ No trailing commas in JSON

## Complete Examples

```json
{
  "label": "Experience Level",
  "description": "How experienced the user is with the subject matter",
  "fieldType": "select",
  "required": false,
  "default": "intermediate",
  "variableName": "experienceLevel",
  "renderAs": "field"
}
```

```json
{
  "label": "Project Goals",
  "description": "Which objectives this project needs to achieve",
  "fieldType": "multiSelect",
  "required": false,
  "default": "clarity",
  "variableName": "projectGoals",
  "renderAs": "field"
}
```

```json
{
  "label": "User Name",
  "description": "The name of the person using this workspace",
  "fieldType": "text",
  "required": true,
  "variableName": "userName",
  "renderAs": "field"
}
```

---
title: Knowledge Base — Complete Reference
description: Everything about structuring knowledge domains, fields, and option files
order: 3
---

# Knowledge Base — Complete Reference

The knowledge base is a structured tree of markdown files that provides domain-specific context to agents. It is organized into **domains → fields → options**.

---

## Directory Structure

```
knowledge/
├── {domain-a}/
│   ├── config.json           ← Domain config (label, icon, color, renderAs)
│   ├── {field-1}/
│   │   ├── config.json       ← Field config (fieldType, variableName, etc.)
│   │   ├── option-a.md       ← An option choice
│   │   └── option-b.md
│   └── {field-2}/
│       ├── config.json
│       └── ...
└── {domain-b}/
    └── ...
```

---

## Domain `config.json` — Complete Schema

```json
{
  "label": "{Human-Readable Domain Name}",
  "description": "{What this domain category covers}",
  "icon": "{single emoji}",
  "color": "{hex color code}",
  "renderAs": "section"
}
```

| Field | Type | Rules |
|---|---|---|
| `label` | string | Human-readable, Title Case |
| `description` | string | One sentence, what this domain contains |
| `icon` | string | Exactly one emoji character |
| `color` | string | Valid hex (e.g., `#ed92a1`) |
| `renderAs` | string | Always `"section"` for top-level domains |

**Example:**
```json
{
  "label": "Teacher Profile",
  "description": "Information about the teacher's background, style, and preferences",
  "icon": "🧑‍🏫",
  "color": "#d59ec8",
  "renderAs": "section"
}
```

---

## Field `config.json` — Complete Schema

```json
{
  "label": "{Human-Readable Field Name}",
  "description": "{What this field represents}",
  "fieldType": "select",
  "required": true,
  "default": "{default-option-slug}",
  "variableName": "{camelCaseVariable}",
  "renderAs": "field"
}
```

| Field | Type | Values / Rules |
|---|---|---|
| `label` | string | Human-readable, Title Case |
| `description` | string | One sentence describing the dimension |
| `fieldType` | string | `"select"` \| `"multiSelect"` \| `"text"` |
| `required` | boolean | `true` blocks conversation until filled |
| `default` | string | **File slug** (filename without `.md`) |
| `variableName` | string | `camelCase` (e.g., `gradeLevel`, `classSize`) |
| `renderAs` | string | Always `"field"` for sub-folders |

### `fieldType` Guide

| Type | Use When |
|---|---|
| `"select"` | User picks exactly one option from a list |
| `"multiSelect"` | User picks one or more options |
| `"text"` | Free-form text input (no option files needed) |

**When `fieldType` is `"text"`:** No option markdown files are needed. The field is a free-form input.

---

## Option Markdown Files — Complete Schema

```markdown
---
title: {Display Title}
description: {Short one-line description shown in the selector}
order: {number for sort order, 1 = first}
---

# {Title}

{Detailed content that gets injected into the agent context.}

## Key Characteristics
- ...

## Best Practices
- ...

## When to Use
- ...
```

### Frontmatter Fields

| Field | Type | Rules |
|---|---|---|
| `title` | string | Human-readable display name |
| `description` | string | Short description visible in selector UI |
| `order` | number | Integer, lower = shown first |

### File Naming
- Use `kebab-case` (e.g., `small-class.md`, `advanced-level.md`)
- The filename (without `.md`) is the **slug** — used as default value in field config
- Avoid spaces or special characters

---

## Content Depth Guidelines

The **body content** of each option file is injected into the agent's context. Make it rich and actionable:

### ✅ Good Option Content
```markdown
# Small Class (Under 15 Students)

## Key Characteristics
- High student-to-teacher ratio enables personalized attention
- Easier to track individual progress
- Group dynamics are intimate — students know each other well

## Instructional Implications
- More time for 1-on-1 guidance per lesson
- Can use collaborative projects with clear role assignments
- Assessment can include oral components effectively

## Common Challenges
- Less peer diversity for group discussions
- Students may rely heavily on teacher rather than peers
```

### ❌ Weak Option Content
```markdown
# Small Class

A class with fewer than 15 students.
```

The richer the content, the better the agent's contextual responses.

---

## How Context Injection Works

When an agent has a knowledge domain selected (via pills) and the user picks an option, the content of that option's `.md` file is injected into the agent's system prompt context window before the conversation starts.

This means:
- **Agents "know" everything written in selected option files**
- Option file content should be written as if briefing an expert
- Use second-person ("When working with this type of class, consider...") or third-person ("Small classes typically require...")

---

## Design Guidelines

| Principle | Guideline |
|---|---|
| **Domain count** | 3–4 domains per workspace |
| **Field count** | 3–6 fields per domain |
| **Option count** | 2–6 options per field |
| **Option content** | 150–500 words per option for rich context |
| **Domain naming** | `kebab-case`, noun phrases (e.g., `data-type`, `user-profile`) |
| **Field naming** | `kebab-case`, noun phrases (e.g., `experience-level`, `class-size`) |
| **Variable naming** | `camelCase` matching the field (e.g., `experienceLevel`, `classSize`) |
| **Required fields** | Only make required what genuinely blocks good output |
| **Defaults** | Always set a sensible default for `select` fields |

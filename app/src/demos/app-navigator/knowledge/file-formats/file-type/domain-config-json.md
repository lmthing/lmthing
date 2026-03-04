---
title: Domain config.json
description: The metadata file for a top-level knowledge domain
order: 4
---

# Domain `config.json` — Knowledge Domain Metadata

Located at `knowledge/{domain-name}/config.json`. Defines how the domain is presented in the Studio UI.

## Full Schema

```json
{
  "label": "{Human-Readable Domain Name}",
  "description": "{What this domain category covers}",
  "icon": "{single emoji}",
  "color": "{hex color code}",
  "renderAs": "section"
}
```

## Field Reference

| Field | Type | Rules |
|---|---|---|
| `label` | string | Human-readable, Title Case, max ~30 chars |
| `description` | string | One sentence — what types of data live here |
| `icon` | string | **Exactly one** emoji character. No text, no multi-char sequences |
| `color` | string | Valid CSS hex: `#` + 6 hex chars (e.g., `#10b981`) |
| `renderAs` | string | Always `"section"` for top-level domain folders |

## Color Suggestions by Domain Type

| Domain Type | Color | Hex |
|---|---|---|
| User/People | Emerald | `#10b981` |
| Content/Media | Violet | `#7c3aed` |
| Settings/Config | Amber | `#f59e0b` |
| Technology/Code | Sky blue | `#0ea5e9` |
| Business/Finance | Rose | `#f43f5e` |
| Education | Orange | `#f97316` |
| Health/Wellness | Teal | `#14b8a6` |
| Data/Analytics | Indigo | `#6366f1` |

## Icon Suggestions by Domain Type

| Domain Type | Icon Examples |
|---|---|
| User profile | 👤 🧑‍💼 👩‍🏫 |
| Content/Writing | ✍️ 📝 📄 |
| Product/Project | 🏗️ 🚀 ⚙️ |
| Knowledge/Learning | 📚 🎓 🧠 |
| Data/Analytics | 📊 🔢 📈 |
| Communication | 💬 📧 📣 |
| Technology | 💻 🖥️ 🔧 |

## Complete Examples

```json
{
  "label": "Student Profile",
  "description": "Information about the student's background, learning style, and academic level",
  "icon": "🎓",
  "color": "#f97316",
  "renderAs": "section"
}
```

```json
{
  "label": "Project Context",
  "description": "Details about the current project, its goals, constraints, and stakeholders",
  "icon": "🚀",
  "color": "#6366f1",
  "renderAs": "section"
}
```

## Validation

- ✅ `renderAs` is exactly `"section"` (string, lowercase)
- ✅ `icon` is exactly one emoji (not a word, not multiple emojis)
- ✅ `color` starts with `#` and is exactly 7 characters total
- ✅ Valid JSON (no trailing commas)
- ✅ `label` is not the same as the folder name (it's the human-readable version)

---
title: Complete Workspace Structure
description: The full folder tree, every file, and how everything connects
order: 1
---

# Complete Workspace Structure

Every workspace is a self-contained folder at `app/src/demos/{subject-slug}/` with this exact tree:

```
{subject-slug}/
│
├── package.json                        ← Workspace manifest
│
├── agents/
│   ├── agent-{role-a}/
│   │   ├── config.json                 ← Runtime field declarations
│   │   ├── instruct.md                 ← Identity, tools, domains, slash actions
│   │   └── values.json                 ← Persisted runtime values (starts as {})
│   └── agent-{role-b}/
│       └── ...
│
├── flows/
│   ├── flow_{action-a}/
│   │   ├── index.md                    ← Flow entry point with step links
│   │   ├── 1.Step Name.md              ← Step instructions
│   │   ├── 2.Step Name.md
│   │   └── ...
│   └── flow_{action-b}/
│       └── ...
│
└── knowledge/
    ├── {domain-a}/
    │   ├── config.json                 ← Domain metadata (label, icon, color)
    │   ├── {field-a}/
    │   │   ├── config.json             ← Field metadata (fieldType, variableName)
    │   │   ├── option-a.md             ← Selectable option with YAML frontmatter
    │   │   └── option-b.md
    │   └── {field-b}/
    │       └── ...
    ├── {domain-b}/
    │   └── ...
    └── {domain-c}/
        └── ...
```

---

## File Count Baseline

| Component | Minimum | Recommended |
|---|---|---|
| Agents | 1 | 2–3 |
| Flows | 1 (one per agent action) | 2–4 |
| Flow steps per flow | 3 | 4–8 |
| Knowledge domains | 2 | 3–4 |
| Fields per domain | 2 | 3–5 |
| Options per field | 2 | 3–5 |
| **Total files** | ~20 | ~50–80 |

---

## Relationship Map

```
Agent (instruct.md)
  ├── selectedDomains ──→ Knowledge Domain (folder)
  │                          └── Field (folder)
  │                               └── Option (markdown file) ──→ context injected
  │
  └── flowId ──────────→ Flow (folder)
                            └── Steps (markdown files) ──→ agent steps through
```

**Critical references that must match:**
- `selectedDomains: ["domain-{name}"]` → must match `knowledge/{name}/` folder
- `flowId="flow_{id}"` → must match `flows/flow_{id}/` folder
- `default: "{slug}"` in field config → must match `{slug}.md` option file
- `emptyFieldsForRuntime: { "{domain}": ["{field}"] }` → must match folder paths

---

## What the Platform Reads at Runtime

When a user opens an agent conversation:

1. **Loads `instruct.md`** → reads agent identity and slash actions
2. **Loads selected knowledge option content** → injects into system context
3. **Reads `values.json`** → pre-fills any previously saved field values
4. **Reads `config.json`** → prompts user for any `emptyFieldsForRuntime` fields
5. **Starts conversation** with full context assembled

When a slash command is triggered:
1. **Finds the matching flow folder** (from `flowId`)
2. **Reads `index.md`** → presents the flow overview
3. **Steps through numbered files** → agent executes each step in sequence

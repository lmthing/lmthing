---
title: Knowledge Architecture Patterns
description: Proven approaches to structuring knowledge domains for maximum agent effectiveness
order: 1
---

# Knowledge Architecture Patterns

The structure of your knowledge base directly determines how well agents can use it. Poor architecture leads to sparse context; good architecture leads to precise, relevant guidance.

---

## Pattern 1: Domain by "Who/What/How"

Organize domains around the three fundamental dimensions of any subject:

| Domain Type | What It Captures | Example Names |
|---|---|---|
| **Subject** (What) | The thing being worked on | `project`, `content-piece`, `codebase`, `document` |
| **Context** (Where/When) | The environment and constraints | `environment`, `platform`, `workflow-context` |
| **Actor** (Who) | The person involved | `user-profile`, `stakeholder`, `audience` |
| **Style** (How) | The manner and preferences | `output-format`, `communication-style`, `quality-bar` |

**Example for a Writing Workspace:**
```
knowledge/
├── content-type/      ← What (article, email, report)
├── audience/          ← Who (experts, students, executives)  
├── writing-style/     ← How (formal, casual, technical)
└── project-context/   ← Where (company type, industry, goals)
```

---

## Pattern 2: Field Granularity Calibration

Avoid both too-broad and too-granular fields.

### ❌ Too Broad
```
knowledge/profile/
└── user-type/
    ├── beginner.md    ← Mixes experience level, role, AND goals into one field
    └── expert.md
```

### ❌ Too Granular
```
knowledge/profile/
├── first-name/        ← Use text field for this, not options
├── last-name/         ← Same
├── birth-year/        ← Never needed
└── city/              ← Rarely needed
```

### ✅ Calibrated
```
knowledge/profile/
├── experience-level/  ← beginner / intermediate / advanced
├── role/              ← developer / designer / manager / student
└── primary-goal/      ← learn / build / review / debug
```

---

## Pattern 3: Option Content as Expert Briefings

Think of option files as briefing documents you'd give to a new consultant joining a project. They should answer:
- "What does this option mean in practice?"
- "How does it change my recommendations?"
- "What should I watch out for?"

**Structure per option file:**
1. One-paragraph overview
2. "Key Characteristics" — what defines this option
3. "Implications" — how it changes agent behavior/recommendations
4. "Avoid" or "Watch Out For" — common mistakes

---

## Pattern 4: Separation of Concern

Keep distinct concerns in distinct domains. Never mix:

| ❌ Mixed | ✅ Separated |
|---|---|
| a domain with both "who" and "what" | `user-profile` + `content-type` |
| a field that covers two dimensions | `tone-and-format` → `tone` + `output-format` |
| an option that describes two choices | `formal-short` → `formal.md` in `tone/` + `short.md` in `length/` |

---

## Pattern 5: Required vs. Optional Fields

| Make Required (`"required": true`) | Keep Optional (`"required": false`) |
|---|---|
| Fields that fundamentally change outputs | Fields with sensible universal defaults |
| Fields with no safe default | Fine-tuning preferences |
| Fields that differ per session/user | Fields consistent across most sessions |

**Rule of thumb:** Require at most 2-3 fields per agent. Too many required fields create friction that discourages use.

---

## Pattern 6: Knowledge Layering

For complex domains, use nested folder depth wisely:

```
knowledge/technology/
├── config.json
├── language/          ← Layer 1: Core choice
│   ├── javascript.md
│   └── python.md
├── framework/         ← Layer 2: Refines the core choice
│   ├── react.md
│   └── vue.md
└── environment/       ← Layer 3: Deployment context
    ├── browser.md
    └── node.md
```

Agents that have `react` selected in `framework` AND `browser` in `environment` will have more precise context than just knowing `javascript`.

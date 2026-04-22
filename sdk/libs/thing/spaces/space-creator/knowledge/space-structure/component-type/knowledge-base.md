---
title: Knowledge Base
description: Structured context system with domains, fields, and options that shape agent behavior
order: 3
---

# Knowledge Base

The knowledge base is a hierarchical context system injected into agent prompts at runtime. It acts as a declarative configuration layer — shaping agent behavior without modifying prompts directly.

## Directory Structure

```
knowledge/
└── {domain}/
    ├── config.json           # Domain: label, icon, color
    └── {field}/
        ├── config.json       # Field: type, default, variableName
        ├── option-a.md       # Selectable option with frontmatter
        ├── option-b.md
        └── option-c.md
```

## Three-Level Hierarchy

### Domains
Top-level categories. Each has a label, emoji icon, hex color, and `renderAs: "section"`. Domains group related knowledge together (e.g., "User Context", "Content Strategy").

### Fields
Typed inputs within a domain. Each field has a `fieldType` (`select`, `multiSelect`, `text`, `number`), a `variableName` for template injection, and optional `required`/`default` values.

### Options
Markdown files with YAML frontmatter (`title`, `description`, `order`). The body contains rich guidance content — characteristics, best practices, decision criteria. Options are the actual knowledge the agent consumes.

## Design Guidelines

- 3-6 domains per space covers most subjects well
- Each domain should have 1-3 fields
- Each field should have 2-5 options with substantive content (150+ words)
- Option content should be actionable — not just definitions, but guidance
- Use `required: true` sparingly — only for fields that fundamentally change agent behavior
- Default values reduce friction; set them to the most common choice

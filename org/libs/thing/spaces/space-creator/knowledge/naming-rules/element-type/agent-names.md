---
title: Agent Names
description: Naming rules for agent identifiers in instruct.md frontmatter
order: 2
---

# Agent Names

Agent names (the `name` field in `instruct.md` frontmatter) use **PascalCase** — each word capitalized, no separators.

## Rules

- PascalCase — each word starts with uppercase, no spaces or hyphens
- Should clearly communicate the agent's role or expertise
- 1-3 words — concise but descriptive
- Must be unique within the space

## Examples

| Good | Bad | Why |
|------|-----|-----|
| `SpaceArchitect` | `space-architect` | Not PascalCase |
| `KnowledgeDesigner` | `Knowledge_Designer` | No underscores |
| `FlowAuthor` | `flowAuthor` | Must start with uppercase |
| `DataAnalyst` | `Data Analyst` | No spaces |

## Relationship to Folder Name

The agent's PascalCase name and its kebab-case folder name should correspond:

| Folder | Name |
|--------|------|
| `agent-space-architect` | `SpaceArchitect` |
| `agent-knowledge-designer` | `KnowledgeDesigner` |
| `agent-flow-author` | `FlowAuthor` |

## Guidelines

- Use role nouns: Architect, Designer, Analyst, Reviewer, Writer, Manager
- Avoid generic names like `Helper`, `Assistant`, `Bot`
- The name appears in the UI — make it meaningful to users

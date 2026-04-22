---
title: Folders and Slugs
description: Naming rules for directories, space slugs, and file paths
order: 1
---

# Folders and Slugs

All folder names and space slugs use **kebab-case** — lowercase words separated by hyphens.

## Rules

- Lowercase only — no uppercase letters
- Words separated by hyphens (`-`)
- No spaces, underscores, or special characters
- Short and descriptive — 2-4 words maximum
- Must be valid filesystem paths

## Examples

| Good | Bad | Why |
|------|-----|-----|
| `space-creator` | `SpaceCreator` | Not kebab-case |
| `agent-formula-expert` | `agent_formula_expert` | Underscores not allowed |
| `user-context` | `user context` | Spaces not allowed |
| `knowledge-design` | `KnowledgeDesign` | Not kebab-case |

## Where This Applies

- Space root folders (`spaces/space-creator/`)
- Agent folders (`agents/agent-space-architect/`)
- Knowledge domain folders (`knowledge/space-structure/`)
- Knowledge field folders (`knowledge/space-structure/component-type/`)
- Option file names (`beginner.md`, `who-what-how.md`)
- The `name` field in `package.json`

## Special Prefixes

- Agent folders: always `agent-` prefix (e.g., `agent-data-analyst`)
- Flow folders: always `flow_` prefix with snake_case (e.g., `flow_create_space`) — this is the one exception to kebab-case

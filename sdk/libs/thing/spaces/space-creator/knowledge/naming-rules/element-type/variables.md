---
title: Variables
description: Naming rules for variableName fields in knowledge configurations
order: 4
---

# Variables

Variable names (the `variableName` field in field `config.json`) use **camelCase** — first word lowercase, subsequent words capitalized.

## Rules

- camelCase — first word lowercase, each subsequent word starts with uppercase
- No hyphens, underscores, or spaces
- Should clearly describe what the variable represents
- Must be unique within the space (across all domains)

## Examples

| Good | Bad | Why |
|------|-----|-----|
| `componentType` | `component-type` | No hyphens |
| `experienceLevel` | `ExperienceLevel` | First word must be lowercase |
| `domainPattern` | `domain_pattern` | No underscores |
| `fieldType` | `field type` | No spaces |

## Relationship to Field Folder

The variable name is a camelCase version of the field's kebab-case folder:

| Field Folder | Variable Name |
|-------------|---------------|
| `component-type` | `componentType` |
| `experience-level` | `experienceLevel` |
| `domain-pattern` | `domainPattern` |
| `agent-pattern` | `agentPattern` |

## How Variables Are Used

Variables are injected into the agent's context at runtime. When a user selects "beginner" for the `experienceLevel` field, the agent receives the full content of `beginner.md` associated with that variable.

Agent instructions can reference variables naturally: "Check the user's experience level and adapt your explanations accordingly."

## Guidelines

- Use descriptive names — `outputFormat` is better than `format`
- Avoid abbreviations — `experienceLevel` not `expLvl`
- Don't duplicate the domain name in the variable — `role` not `userContextRole`

---
title: Specialist
description: A focused expert in one domain — the most common and effective agent pattern
order: 1
---

# Specialist Pattern

The specialist is an agent with deep expertise in a single area. It does one thing exceptionally well.

## Characteristics

- **Narrow focus** — Knows a lot about a little. Its knowledge domains are tightly scoped.
- **Direct interaction** — Users talk to it directly about its area of expertise.
- **Self-contained** — Can complete tasks without coordinating with other agents.
- **Clear boundaries** — Easy for users to understand what it can and can't do.

## When to Use

- The space has distinct, non-overlapping areas of expertise
- Each agent handles a different facet of the subject (e.g., one writes content, another analyzes data)
- Users should know exactly which agent to talk to for a given task

## Implementation

```markdown
---
name: "FormulaExpert"
description: "Specialist in spreadsheet formulas — writes, explains, and debugs formulas"
tools: ["read", "search"]
enabledKnowledgeFields: ["domain-formulas", "domain-user-context"]
---
```

Attach only the domains the specialist needs. A formula expert doesn't need design pattern knowledge.

## Examples

- `ContentWriter` — Writes blog posts, emails, social media content
- `DataAnalyst` — Analyzes datasets, creates visualizations, generates reports
- `CodeReviewer` — Reviews code for bugs, security issues, and best practices

## Guidelines

- 2-3 specialists per space covers most use cases
- Each specialist should have at least one slash action linked to a flow
- Specialists are the default choice — use other patterns only when specialists aren't sufficient

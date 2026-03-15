---
title: Coordinator
description: An orchestrator agent that delegates work across domains and manages multi-step processes
order: 2
---

# Coordinator Pattern

The coordinator is a generalist that oversees complex processes spanning multiple domains. It knows a little about everything and delegates deep work to specialists.

## Characteristics

- **Broad knowledge** — Attaches many or all knowledge domains, but at a surface level.
- **Process-oriented** — Excels at multi-step workflows, checklists, and project plans.
- **Delegating** — In conversations, it may suggest which specialist to consult for deeper work.
- **Holistic view** — Understands how the pieces fit together, not just individual parts.

## When to Use

- The space involves multi-step processes that cross domain boundaries
- Users need a "starting point" agent that helps them figure out what to do
- Complex flows require an agent that understands the full pipeline

## Implementation

```markdown
---
name: "ProjectManager"
description: "Coordinates the full project lifecycle — plans, tracks, and delegates across all domains"
tools: ["read", "search", "edit"]
enabledKnowledgeFields:
  ["domain-requirements", "domain-architecture", "domain-testing", "domain-user-context"]
---
```

Attach most or all domains. The coordinator needs breadth, not depth.

## Examples

- `SpaceArchitect` — Plans and scaffolds entire spaces across all components
- `ProjectManager` — Breaks projects into tasks, assigns to appropriate specialists
- `OnboardingGuide` — Walks new users through the full platform

## Guidelines

- One coordinator per space is usually enough
- Pair with 1-2 specialists for the deep work
- Coordinator flows tend to be longer (5-8 steps) since they cover more ground
- The coordinator's instructions should explicitly reference when to suggest consulting a specialist

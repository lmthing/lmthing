---
title: Agents
description: AI specialists with distinct roles, tools, and knowledge attachments
order: 1
---

# Agents

Agents are the AI specialists that live inside a space. Each agent has a focused role and its own configuration.

## Directory Structure

```
agents/
└── agent-{role}/
    ├── config.json       # Runtime field requirements
    ├── instruct.md       # Identity, tools, domains, slash actions
    ├── values.json       # Runtime state (starts empty {})
    └── conversations/    # Conversation history (auto-generated)
```

## Key Files

### instruct.md
The agent's identity document. YAML frontmatter defines:
- **name** — PascalCase identifier (e.g., `SpaceArchitect`)
- **description** — One sentence explaining the agent's expertise
- **tools** — Array of tool names the agent can use
- **selectedDomains** — Knowledge domains attached to this agent (prefixed `domain-`)

The body contains `<slash_action>` tags linking to flows, plus the main system prompt instructions.

### config.json
Declares which knowledge fields need user input before the agent runs:
```json
{
  "emptyFieldsForRuntime": {
    "domain-name": ["field-slug"]
  }
}
```

### values.json
Starts as `{}`. Populated at runtime with the user's field selections.

## Design Guidelines

- Each agent should have a single, well-defined responsibility
- Attach only the knowledge domains the agent actually needs
- 2-4 agents per space is typical; avoid overlap in expertise
- Agent names should clearly communicate the role (e.g., `DataAnalyst`, not `Helper`)

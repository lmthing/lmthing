---
title: Flows
description: Sequential multi-step workflows triggered by agent slash commands
order: 2
---

# Flows

Flows are step-by-step workflows that agents execute when a user invokes a slash command. They turn complex processes into guided sequences.

## Directory Structure

```
flows/
└── flow_{action}/
    ├── index.md              # Overview + numbered step links
    ├── 1.Step Name.md        # First step
    ├── 2.Step Name.md        # Second step
    └── ...
```

## Key Files

### index.md
The flow's entry point. Contains:
- A title (matching the flow's purpose)
- A brief description of what the flow accomplishes
- A numbered list of step links

```markdown
# Flow Title

Description of what this flow does.

1. [Step Name](1.Step Name.md)
2. [Step Name](2.Step Name.md)
```

### Step Files
Each step is a discrete markdown file with clear instructions for what the agent should do at that point. Steps should:
- Have a clear, action-oriented title
- Contain 80-150 words of guidance
- Tell the agent what to gather, decide, or produce
- Reference knowledge domains when relevant

## Design Guidelines

- 4-8 steps per flow — fewer feels shallow, more feels tedious
- Each step should produce a concrete output or decision
- Follow patterns like: Gather → Plan → Execute → Review
- Step names should use Title Case with spaces (the filename is the display name)
- Flow IDs use `flow_` prefix + snake_case (e.g., `flow_create_space`)

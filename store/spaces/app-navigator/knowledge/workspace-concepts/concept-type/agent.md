---
title: Agent — Complete Reference
description: Everything about creating, configuring, and connecting agents in a workspace
order: 1
---

# Agent — Complete Reference

An agent is a named AI assistant within a workspace. It has a persistent identity, system prompt, domain knowledge, and executable flows.

---

## Directory Structure

```
agents/agent-{slug}/
├── config.json       ← runtime field declarations
├── instruct.md       ← identity, tools, domain links, slash actions
└── values.json       ← persisted runtime field values (usually starts as {})
```

**Slug naming:** `kebab-case`, prefixed with `agent-` (e.g., `agent-lesson-planner`, `agent-code-reviewer`).

---

## `instruct.md` — Complete Schema

```markdown
---
name: "{AgentName}"
description: "{One-line what this agent does}"
tools: ["{tool-1}", "{tool-2}"]
enabledKnowledgeFields: ["domain-{domain1}", "domain-{domain2}"]
---

<slash*action name="{Action Display Name}" description="{What it does}" flowId="flow*{action_id}">
/{command}
</slash_action>
```

### Frontmatter Fields

| Field                    | Type   | Rules                                                           |
| ------------------------ | ------ | --------------------------------------------------------------- |
| `name`                   | string | **PascalCase** (e.g., `DataAnalyst`, `ContentWriter`)           |
| `description`            | string | One sentence, action-oriented                                   |
| `tools`                  | array  | `kebab-case` strings (e.g., `"chart-suggester"`)                |
| `enabledKnowledgeFields` | array  | Must be prefixed with `"domain-"` and match folder name exactly |

### `<slash_action>` Attributes

| Attribute     | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `name`        | yes      | Display label shown in the UI                  |
| `description` | yes      | Short description of what the action triggers  |
| `flowId`      | yes      | Must exactly match the folder name in `flows/` |

**Multiple slash actions** are fully supported — add one `<slash_action>` block per action:

```markdown
<slash_action name="Generate Report" description="Builds a full report" flowId="flow_generate_report">
/report
</slash_action>

<slash_action name="Summarize" description="Summarizes current context" flowId="flow_summarize">
/summary
</slash_action>
```

---

## `config.json` — Runtime Fields

Runtime fields are knowledge fields whose value is prompted from the user at the start of each conversation instead of being pre-filled.

```json
{
  "runtimeFields": {
    "{domain-folder-name}": ["{field-folder-name}", "{another-field}"]
  }
}
```

**Example:**

```json
{
  "runtimeFields": {
    "user-profile": ["name", "experience-level"],
    "project-context": ["goal"]
  }
}
```

- Domain keys must match the **folder name** inside `knowledge/` (not the label)
- Field values must match **folder names** inside `knowledge/{domain}/`
- Fields listed here will be shown as empty inputs when the agent starts

---

## `values.json`

Stores the current values for all runtime fields. When empty, use `{}`.

```json
{
  "user-profile": {
    "name": "Alex",
    "experience-level": "intermediate"
  }
}
```

This file is updated automatically by the platform when a user fills in runtime fields.

---

## System Prompt (Main Instructions)

The Main Instructions textarea on the Agent Configuration page is the agent's **system prompt**. Best practices:

1. **Start with identity** — "You are a [role] specializing in [domain]."
2. **Define tone** — Formal / casual / technical / educational
3. **Reference knowledge** — "Use the user's experience level from their profile to calibrate explanations."
4. **Set constraints** — "Only answer questions about [topic]. Politely redirect off-topic requests."
5. **Define output format** — "Always structure your responses with a heading, bullet points, and a recommended next step."

**What NOT to put in instructions:**

- Content that should be in knowledge files (put reference data in knowledge, not here)
- Lengthy option lists (those belong in knowledge field options)

---

## Knowledge Attachment (Domain Selection)

Agents access knowledge through the **pills bar** on the Agent Configuration page. Active pills (violet with checkmark) inject that domain's knowledge into the agent's context.

The `enabledKnowledgeFields` array in `instruct.md` defines the **initial** selection. Users can toggle pills to override.

**Key principle:** Attach only what's relevant. Irrelevant knowledge pollutes the agent's context and reduces accuracy.

---

## Tools

Tools are identifiers for domain-specific capabilities. They appear in the `tools` array in instruct.md:

```markdown
tools: ["data-cleaner", "chart-suggester", "formula-builder"]
```

These are descriptive strings that help the platform and agent understand available capabilities. Use `kebab-case`, action-oriented names.

**Common patterns:**

- `{noun}-{verb}` → `formula-builder`, `data-cleaner`
- `{domain}-{action}` → `sheet-formatter`, `grammar-checker`
- `{verb}-{noun}` → `suggest-chart`, `analyze-trend`

---

## Design Guidelines

- Create **2-3 agents** per workspace with **distinct, non-overlapping roles**
- Each agent should have **at least one flow** for structured multi-step tasks
- Agents sharing a workspace can reference the **same knowledge domains** — each brings a different perspective
- Agent names should reflect expertise: `FormulaExpert` not `Agent1`

---
title: instruct.md (Agent)
description: The agent identity file — frontmatter + slash action declarations
order: 2
---

# `instruct.md` — Agent Identity File

Located at `agents/agent-{slug}/instruct.md`. This file defines the agent's name, capabilities, knowledge links, and available slash commands.

## Full Schema

```markdown
---
name: "{AgentName}"
description: "{One-sentence description of what this agent does}"
tools: ["{tool-1}", "{tool-2}", "{tool-3}"]
enabledKnowledgeFields: ["domain-{domain1}", "domain-{domain2}"]
---

<slash*action name="{Display Name}" description="{What this action does}" flowId="flow*{action_id}">
/{command}
</slash_action>
```

## Frontmatter Field Reference

| Field                    | Type   | Format                           | Example                                                     |
| ------------------------ | ------ | -------------------------------- | ----------------------------------------------------------- |
| `name`                   | string | PascalCase, no spaces            | `"FormulaExpert"`                                           |
| `description`            | string | One sentence, max ~80 chars      | `"Analyzes spreadsheet formulas and suggests improvements"` |
| `tools`                  | array  | kebab-case strings               | `["formula-parser", "data-cleaner"]`                        |
| `enabledKnowledgeFields` | array  | `"domain-"` prefix + folder name | `["domain-spreadsheet", "domain-use-case"]`                 |

## `<slash_action>` Reference

| Attribute          | Required | Rules                                                |
| ------------------ | -------- | ---------------------------------------------------- |
| `name`             | ✅       | Display title shown in the Actions panel, Title Case |
| `description`      | ✅       | One sentence explaining what the action does         |
| `flowId`           | ✅       | Must **exactly** match the folder name in `flows/`   |
| Body (inside tags) | ✅       | The slash command string, starts with `/`            |

## Validation Rules

- ✅ YAML frontmatter is valid (proper indentation, no tabs)
- ✅ `name` has no spaces or special characters
- ✅ `enabledKnowledgeFields` values start with `"domain-"` and match existing folders
- ✅ `flowId` values match existing `flows/` folder names
- ✅ Slash command body starts with `/`
- ✅ No duplicate slash commands
- ✅ Tools use kebab-case

## Example — Complete

```markdown
---
name: "LessonPlanAgent"
description: "Creates detailed lesson plans aligned to curriculum standards and student needs"
tools: ["curriculum-search", "activity-designer", "assessment-builder"]
enabledKnowledgeFields: ["domain-classroom", "domain-curriculum", "domain-teacher"]
---

<slash_action name="Create Lesson Plan" description="Generates a complete lesson plan for a topic" flowId="flow_create_lesson">
/plan
</slash_action>

<slash_action name="Quick Quiz" description="Creates a short quiz for any topic" flowId="flow_quick_quiz">
/quiz
</slash_action>
```

## Main Instructions (System Prompt Body)

The text after the closing `---` of frontmatter (and before any `<slash_action>` tags) is the agent's main system prompt. Alternatively, the Main Instructions are saved separately in the Studio UI.

Best practice: Keep the body as a clear, structured system prompt — not as a repeat of what's already in the knowledge base.

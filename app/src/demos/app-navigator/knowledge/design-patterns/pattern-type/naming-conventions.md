---
title: Naming Conventions
description: Complete naming rules for every element in a workspace
order: 2
---

# Naming Conventions

Consistent naming prevents errors (broken `flowId` references, missing `selectedDomains`) and makes workspaces easier to navigate.

---

## Master Reference Table

| Element | Case | Example |
|---|---|---|
| Workspace slug | `kebab-case` | `google-sheets`, `customer-support` |
| Agent folder | `kebab-case`, `agent-` prefix | `agent-data-analyst`, `agent-lesson-planner` |
| Agent name (in instruct.md) | `PascalCase` | `DataAnalyst`, `LessonPlanAgent` |
| Flow folder | `snake_case`, `flow_` prefix | `flow_generate_report`, `flow_analyze_data` |
| Flow step file | Number + `.` + Title Case words | `1.Gather Context.md`, `3.Write the Draft.md` |
| Knowledge domain folder | `kebab-case` | `user-profile`, `data-type`, `classroom` |
| Knowledge field folder | `kebab-case` | `experience-level`, `class-size` |
| Option file | `kebab-case`, no prefix needed | `advanced.md`, `small-class.md` |
| Variable name (field) | `camelCase` | `experienceLevel`, `classSize` |
| Tool identifiers | `kebab-case` | `chart-suggester`, `formula-parser` |

---

## Agent Naming

**Folder name:** `agent-{role-in-kebab-case}`

Good agent folder names:
- `agent-data-analyst`
- `agent-content-writer`
- `agent-code-reviewer`
- `agent-lesson-planner`

**`name` in `instruct.md`:** `PascalCase`, no hyphens or underscores

Good `name` values:
- `DataAnalyst`
- `ContentWriter`
- `CodeReviewer`
- `LessonPlanAgent`

❌ Avoid:
- `agent_data_analyst` (wrong case for `name`)
- `Data Analyst` (no spaces)
- `data-analyst` (should be PascalCase)

---

## Flow Naming

**Folder:** `flow_` + `snake_case` action description

Good flow folder names:
- `flow_generate_report`
- `flow_analyze_data`
- `flow_create_lesson_plan`
- `flow_code_review`

**Step files:** `{N}.{Title Case Name}.md`

Good step file names:
- `1.Gather Context.md`
- `2.Define Objectives.md`
- `3.Draft the Output.md`
- `4.Review and Refine.md`
- `5.Format and Export.md`

**Critical:** The `flowId` in `<slash_action>` must **exactly match** the folder name:
```markdown
<!-- folder: flows/flow_generate_report/ -->
<slash_action flowId="flow_generate_report">   ✅
<slash_action flowId="flow_Generate_Report">   ❌ (case mismatch)
<slash_action flowId="generate_report">         ❌ (missing prefix)
```

---

## Knowledge Domain & Field Naming

**Domain folders:** `kebab-case`, noun phrases

Good domain names:
- `user-profile` (not `userProfile`, not `user_profile`)
- `data-type`
- `project-context`
- `output-preferences`

**Field folders:** `kebab-case`, noun phrases

Good field names:
- `experience-level`
- `class-size`
- `content-format`
- `primary-goal`

**`variableName` in field `config.json`:** `camelCase`, unique within domain

Good variable names:
- `experienceLevel`
- `classSize`
- `contentFormat`
- `primaryGoal`

**`selectedDomains` in agent `instruct.md`:** Must use `"domain-"` prefix + exact folder name

```yaml
selectedDomains: ["domain-user-profile", "domain-data-type"]
#  Prefix ↑                ↑ exact folder name
```

---

## Option File Naming

Option slugs (the filename without `.md`) must:
- Be `kebab-case`
- Be unique within the field folder
- Match the `default` value in `field/config.json`

Good option slugs:
- `beginner.md`, `intermediate.md`, `advanced.md`
- `small-team.md`, `large-enterprise.md`
- `formal.md`, `casual.md`, `technical.md`

❌ Avoid:
- `Option 1.md` (has spaces)
- `ADVANCED.md` (uppercase)
- `intermediate_level.md` (has underscores — use hyphens)

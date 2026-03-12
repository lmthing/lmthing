---
title: Flow — Complete Reference
description: Everything about creating multi-step flows and linking them to agent slash commands
order: 2
---

# Flow — Complete Reference

A flow is a named sequence of markdown step files that an agent executes when its slash command is triggered. Each step is an instruction page guiding the agent (and optionally the user) through a structured process.

---

## Directory Structure

```
flows/
└── flow_{action_id}/
    ├── index.md             ← Required: title + numbered list of step links
    ├── 1.Step Name.md       ← Step 1
    ├── 2.Step Name.md       ← Step 2
    ├── 3.Step Name.md       ← Step 3
    └── ...
```

**Naming rules:**
- Folder: `flow_` prefix + `snake_case` (e.g., `flow_generate_report`, `flow_analyze_data`)
- Step files: Number prefix + `.` + descriptive name + `.md` (e.g., `1.Gather Context.md`)
- Spaces are allowed in step filenames

---

## `index.md` — Complete Schema

```markdown
# {Flow Display Title}

{One or two sentence description of what this flow accomplishes.}

1. [{Step 1 Name}](1.{Step%20Name}.md)
2. [{Step 2 Name}](2.{Step%20Name}.md)
3. [{Step 3 Name}](3.{Step%20Name}.md)
4. [{Step 4 Name}](4.{Step%20Name}.md)
```

- **Title:** Human-readable, title-case
- **Links:** Use URL-encoded filenames (spaces become `%20`) in the URL portion
- **Link text:** Human-readable step name (can have spaces)
- The description explains the flow's purpose, not the steps

**Example:**
```markdown
# Generate Assessment

This flow creates a custom student assessment based on the current lesson plan and learning objectives.

1. [Identify Learning Goals](1.Identify%20Learning%20Goals.md)
2. [Select Question Types](2.Select%20Question%20Types.md)
3. [Draft Questions](3.Draft%20Questions.md)
4. [Format the Assessment](4.Format%20the%20Assessment.md)
5. [Review and Finalize](5.Review%20and%20Finalize.md)
```

---

## Step Files — Content Patterns

Each step file is a markdown document with instructions for that step. Common patterns:

### Information-Gathering Step
Ask the user for required context before moving to the next step:
```markdown
# Identify Learning Goals

Before generating the assessment, we need to know what students should learn.

Ask the user:
- What is the main topic of this assessment?
- What grade level are the students?
- What learning objectives should this assessment test?

Summarize what you gather before moving to the next step.
```

### Decision Step
Present options and guide the user to make a choice:
```markdown
# Select Question Types

Based on the learning goals, recommend the best question types:

| Type | Best For |
|---|---|
| Multiple choice | Knowledge recall, concept recognition |
| Short answer | Understanding, explanation |
| Essay | Analysis, critical thinking |
| True/False | Quick comprehension checks |

Ask the user to confirm the types, or suggest a balanced mix.
```

### Execution Step
Perform the core task of the flow:
```markdown
# Draft Questions

Using the learning goals and selected question types, draft the assessment questions now.

Guidelines:
- Write questions in clear, grade-appropriate language
- Start with easier questions and increase difficulty
- Include at least one question per learning objective
- For multiple choice, provide 4 options with exactly one correct answer

Generate the full question set and present it for review.
```

### Review Step
Let the user review and iterate:
```markdown
# Review and Finalize

Present the complete assessment to the user. Ask:
- Are all learning objectives covered?
- Is the difficulty appropriate?
- Any questions to add, remove, or reword?

Make requested edits, then provide the final version in a clean, copyable format.
```

---

## Linking Flows to Agents

In `instruct.md`, use the `<slash_action>` tag:

```markdown
<slash_action name="Generate Assessment" description="Creates a student assessment aligned to learning objectives" flowId="flow_generate_assessment">
/gen
</slash_action>
```

The `flowId` must **exactly match** the folder name (including the `flow_` prefix).

Once attached via the UI (Actions tab → "Attach Flow"), the flow appears as an action card showing:
- Slash command (e.g., `/gen`)
- Flow name
- Step count
- Active/Inactive status badge

---

## Design Guidelines

| Principle | Detail |
|---|---|
| **Step count** | 4–8 steps per flow. Fewer = too vague. More = overwhelming. |
| **Step granularity** | Each step = one discrete action or decision |
| **Step names** | Action-oriented verbs: "Analyze Data", "Draft Report" — not "Step 2" |
| **Sequential dependency** | Each step should reference or build on the previous |
| **Parallelism** | Multiple flows in a workspace should not have overlapping step names |
| **One flow per task** | Don't combine unrelated tasks in one flow |

---

## Example Flows By Domain

### Data / Analytics
- `flow_analyze_data` → Understand Context → Identify Metrics → Run Analysis → Visualize → Recommend Actions
- `flow_clean_data` → Preview Data → Identify Issues → Suggest Fixes → Apply Corrections → Validate

### Writing / Content
- `flow_draft_article` → Define Topic → Outline Structure → Write Draft → Edit for Clarity → Format for Publication
- `flow_review_content` → Read Submission → Score Criteria → Write Feedback → Suggest Improvements

### Education
- `flow_create_lesson` → Set Objectives → Design Activities → Select Resources → Write Assessment → Review Plan
- `flow_generate_quiz` → Identify Topics → Generate Questions → Balance Difficulty → Format Output

### Development
- `flow_code_review` → Understand Context → Check Correctness → Review Style → Assess Performance → Write Summary
- `flow_write_tests` → Identify Functions → List Edge Cases → Write Unit Tests → Validate Coverage

# Workspace Generator Rules & System Prompt

## System Prompt for AI Workspace Generator

```
You are an AI Workspace Generator. Given a subject/domain (e.g., "education", "google-sheets", "music production"), you will generate a complete demo space with agents, tasklists, and a structured knowledge base in the LMThing **new spec**.
```

## Output Structure

Generate a space at `store/spaces/{subject-slug}/` with this exact structure:

```
{subject-slug}/
├── package.json
├── agents/
│   ├── agent-{role-1}/
│   │   └── instruct.md          # YAML frontmatter + system-prompt body
│   └── agent-{role-2}/
│       └── instruct.md
├── tasklists/
│   ├── {tasklist_1}/
│   │   ├── 01-{task-id}.md       # ordered task files (DAG)
│   │   ├── 02-{task-id}.md
│   │   └── ...
│   └── {tasklist_2}/
│       └── ...
└── knowledge/
    ├── {domain-1}/
    │   ├── index.md              # domain descriptor (section)
    │   ├── {field-1}/
    │   │   ├── index.md          # field descriptor
    │   │   ├── option-a.md
    │   │   └── option-b.md
    │   └── {field-2}/
    │       └── ...
    └── {domain-2}/
        └── ...
```

> There is **no** `config.json`, `values.json`, or `flows/`. All agent metadata
> (including the runtime-field selection and saved form values) lives in
> `instruct.md` frontmatter; flows are `tasklists/`; knowledge domains/fields are
> described by `index.md`.

## File Format Rules

### 1. package.json

```json
{
  "name": "{subject-slug}",
  "version": "1.0.0",
  "private": true
}
```

No `dependencies` unless the space ships `functions/` that import them.

### 2. Agent — `agents/agent-{role}/instruct.md`

```markdown
---
title: {AgentName}                       # PascalCase
knowledge:                               # "domain/field" references
  - {domain}/{field}
functions: []                            # function names from functions/
components: []                           # component names from components/
actions:                                 # slash actions (omit / [] for model-driven)
  - id: {action_id}
    label: "{Action Name}"
    description: "{What this action does}"
    tasklist: {tasklist_name}            # must match a tasklists/ directory
defaultAction: {action_id}               # optional — routes the first turn
dependencies: []                         # "space/agent" delegation targets
runtimeFields:                           # fields prompted at runtime
  {domain}: [{field}]
formValues:                              # pre-filled field values
  {domain}: { {field}: {value} }
---

{System-prompt body: 2-3 imperative sentences describing the agent's role.}
```

- `title`: PascalCase agent name.
- `knowledge`: list of `domain/field` refs — each must resolve under `knowledge/`.
- `actions[].tasklist`: must name an existing `tasklists/` directory.
- `runtimeFields` / `formValues`: optional; carry the runtime-field selection and saved values.

### 3. Tasklist — `tasklists/{name}/NN-{task-id}.md`

```markdown
---
id: {task-id}
output:                                  # schema this task resolves with
  {field}: {type}                        # e.g. recipe: string
dependsOn: [{upstream-task-id}]          # [] for the first task
optional: false
goal: false                              # exactly ONE task per tasklist is goal: true
---

{Imperative instruction telling the model what to produce, ending with an
explicit resolve, e.g.:}  Resolve: currentTask.resolve({ {field}: '...' })
```

- Files are zero-padded and ordered: `01-`, `02-`, `03-` …
- Exactly one task per tasklist has `goal: true` (conventionally the last).
- `dependsOn` ids must reference earlier tasks in the same tasklist.

### 4. Knowledge Base

#### Domain descriptor — `knowledge/{domain}/index.md`

```markdown
---
label: {Human-Readable Domain Name}
description: {What this domain covers}
icon: {single emoji}
color: "{hex color code}"
renderAs: section
---

{Optional domain description.}
```

#### Field descriptor — `knowledge/{domain}/{field}/index.md`

```markdown
---
type: string
variable: {camelCaseVariable}
default: {default-option-slug}           # optional
label: {Human-Readable Field Name}
fieldType: select | multiSelect | text | number
required: true | false
renderAs: field
---

{Field description.}
```

#### Option file — `knowledge/{domain}/{field}/{slug}.md`

```markdown
---
title: {Display Title}
description: {Short description}
order: {number for sorting}
---

# {Title}

{Detailed content: key characteristics, best practices, considerations.}
```

## Design Guidelines

- **Agents**: 1-3 per space with distinct roles; an agent with a slash action links it to a tasklist.
- **Tasklists**: one per major action, 4-8 ordered tasks forming a DAG; exactly one goal task.
- **Knowledge**: 3-4 domains, 3-6 fields each, 2-6 options per field.

### Naming Conventions

- Folder names: `kebab-case`
- Variable names: `camelCase`
- Agent titles: `PascalCase`
- Tasklist names: `snake_case`
- File slugs: `kebab-case`

## Validation Checklist

- [ ] All markdown frontmatter is valid YAML
- [ ] Agent `knowledge` refs resolve to existing `knowledge/{domain}/{field}`
- [ ] Every `actions[].tasklist` matches an existing `tasklists/` directory
- [ ] Exactly one task per tasklist has `goal: true`; `dependsOn` ids exist upstream
- [ ] Field `default` references an existing option slug
- [ ] Icons are single emojis; colors are valid hex codes

## Quick Reference Card

| Component | Location | Format | Key Fields |
|-----------|----------|--------|------------|
| Package | `package.json` | JSON | name, version, private |
| Agent | `agents/agent-*/instruct.md` | MD+YAML | title, knowledge, functions, components, actions, runtimeFields, formValues |
| Tasklist Task | `tasklists/*/NN-*.md` | MD+YAML | id, output, dependsOn, optional, goal |
| Domain | `knowledge/*/index.md` | MD+YAML | label, icon, color, renderAs: section |
| Field | `knowledge/*/*/index.md` | MD+YAML | type, variable, default, label, fieldType, required, renderAs: field |
| Option | `knowledge/*/*/*.md` | MD+YAML | title, description, order |

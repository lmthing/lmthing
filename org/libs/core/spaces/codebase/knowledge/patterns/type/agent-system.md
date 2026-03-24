---
title: Agent System
description: Space architecture — agents, flows, knowledge, naming conventions, and runtime behavior
order: 1
---

# Agent System Patterns

The agent system is built around **Spaces** — self-contained workspaces with three pillars: Agents, Flows, and Knowledge.

## Space Structure

```
{space-slug}/
├── package.json              # metadata (name, version)
├── agents/                   # AI specialists
│   └── agent-{role}/
│       ├── config.json       # runtime field requirements
│       ├── instruct.md       # personality, tools, slash actions
│       ├── values.json       # runtime state (starts empty)
│       └── conversations/
├── flows/                    # step-by-step workflows
│   └── flow_{action}/
│       ├── index.md          # overview + step links
│       └── {N}.Step Name.md  # numbered steps
├── functions/                # utility functions (pure JS/TS)
│   └── functionName.tsx
├── components/               # React display components
│   ├── view/                 # read-only display
│   └── form/                 # interactive forms
└── knowledge/                # structured domain data
    └── {domain}/
        ├── config.json       # section: label, icon, color
        └── {field}/
            ├── config.json   # field: type, default, variableName
            └── option-a.md   # selectable option with frontmatter
```

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Folders | `kebab-case` | `agent-formula-expert` |
| Variables | `camelCase` | `gradeLevel` |
| Agent names | `PascalCase` | `FormulaExpert` |
| Flow IDs | `snake_case` + `flow_` prefix | `flow_generate_report` |
| Functions | `camelCase` | `estimateCalories` |
| Components | `PascalCase` | `RecipeCard` |
| Knowledge domains | `kebab-case` | `cooking-techniques` |
| Knowledge fields | `kebab-case` | `cuisine-type` |
| Knowledge options | `kebab-case` | `dairy-free` |

## Agent Config Pattern

`config.json` declares three things:

1. **Knowledge** — which domains/fields are enabled, with defaults:
   ```json
   { "knowledge": { "cuisine": { "type": "italian" }, "dietary": true } }
   ```

2. **Components** — which display components the agent can use:
   ```json
   { "components": ["RecipeCard", "MealPlanCard", "catalog/component/form/*"] }
   ```

3. **Functions** — which utility functions the agent can call:
   ```json
   { "functions": ["buildGroceryList", ["catalog/shell", { "allowedCommands": ["ls"] }]] }
   ```

The `catalog/` prefix references shared library functions with optional security constraints.

## Agent Instruct Pattern

`instruct.md` defines the agent's personality and behavior:

1. **Persona** — name, role, expertise
2. **Behavior steps** — ordered instructions (ask → loadKnowledge → stop → compute → display)
3. **Rules** — constraints on behavior (always load knowledge first, never load all files)
4. **Component list** — what each display component shows
5. **Function list** — what each utility function does

## Flow Step Pattern

Each step file has YAML frontmatter + markdown body:

```yaml
---
description: What this step accomplishes
model: claude-3-5-sonnet
temperature: 0.3
---
```

The body describes the step's purpose and includes an `<output>` block:

```xml
<output target="variableName">
{
  "fieldName": "string — description",
  "items": ["array — of items"]
}
</output>
```

Temperature guidelines:
- **0.2** — Precise/analytical tasks (calculations, lists, validation)
- **0.3** — Structured output (preference gathering, step-by-step generation)
- **0.4** — Creative/variant output (recommendations, design, writing)

## Knowledge Loading

Agents load knowledge at runtime using the selector pattern:

```javascript
loadKnowledge({ domain: { field: { option: true } } })
```

This returns markdown content for each selected option. Agents should:
- Only load specific relevant options (never load everything)
- Always load knowledge before giving advice
- Use the knowledge content to inform responses, not fabricate answers

## Runtime Fields

`config.json` can declare `runtimeFields` — knowledge fields that require user input before the agent runs:

```json
{
  "runtimeFields": {
    "cuisine": ["type"],
    "dietary": ["restriction"]
  }
}
```

This maps domain → field names that must be populated at runtime.

# knowledgeAgentPlugin — THING Space Agent Integration

## Overview

The built-in knowledge agent plugin provides `defKnowledgeAgent` for registering a THING space agent as a callable tool. It reads the agent's config, knowledge structure, and instruction files to automatically build a Zod input schema and inject knowledge context at runtime. It is **auto-loaded**.

**Source:** `src/plugins/knowledgeAgent/`

## Usage

```typescript
import { runPrompt } from 'lmthing';

const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
  defKnowledgeAgent(
    './spaces/education',
    './spaces/education/agents/agent-lesson-plan'
  );
  $`Call the LessonPlanAgent with message "/generate"`;
}, { model: 'openai:gpt-4o' });
```

## How It Works

1. **Reads agent config** (`config.json`) to discover `runtimeFields` — which knowledge domains/fields the agent needs
2. **Reads knowledge structure** from the space's `knowledge/` directory:
   - Domain configs (`config.json` with label, icon, color)
   - Field configs (field type, variable name, defaults)
   - Options (markdown files with YAML frontmatter)
3. **Reads instruct.md** for agent name, description, and personality
4. **Parses slash actions** from `<slash_action>` tags in instruct.md
5. **Builds a Zod input schema** from knowledge fields (select, multiSelect, text, number)
6. **Registers as defAgent** with the constructed schema

## Slash Actions & Flows

If the agent's `instruct.md` contains `<slash_action>` tags, sending the slash command as the message triggers a flow:

```markdown
<slash_action name="Generate" description="Generate a lesson plan" flowId="flow_generate_lesson">
/generate
</slash_action>
```

When triggered:
1. Flow steps are read from `flows/{flowId}/` directory
2. A task list is created from flow steps via `defTaskList`
3. Each step's `<output>` tag defines structured output tools
4. Output from completed steps feeds into subsequent steps via state
5. An effect injects current step context into the system prompt

## Knowledge Context Injection

When the agent is called:
- Selected knowledge options are resolved from the input schema values
- Option markdown content is injected as context sections
- Format: `## {Field Label}: {Option Title}\n\n{option content}`

## Supported Field Types

| Type | Schema |
|------|--------|
| `select` | `z.enum([...options])` |
| `multiSelect` | `z.array(z.enum([...options]))` |
| `text` | `z.string()` |
| `number` | `z.number()` |

All fields include a `message` input for the agent's instruction or slash command.

## Space Directory Structure Expected

```
{space}/
├── agents/{agent}/
│   ├── config.json       # { runtimeFields: { domain: [field1, field2] } }
│   └── instruct.md       # YAML frontmatter (name, description) + body + slash_action tags
├── flows/{flowId}/
│   ├── index.md
│   └── {N}.Step Name.md  # Optional frontmatter (description, model, temperature) + <output> tags
└── knowledge/{domain}/{field}/
    ├── config.json        # { label, description, fieldType, required, default, variableName }
    └── {option}.md        # YAML frontmatter (title, description, order) + content
```

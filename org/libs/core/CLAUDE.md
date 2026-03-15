# CLAUDE.md - Development Guide for lmthing

## Project Overview

**lmthing** is a TypeScript library for building agentic AI workflows. It provides a high-level abstraction over the Vercel AI SDK's `streamText` function, enabling developers to create complex multi-agent systems with tools, hooks, and hierarchical prompts.

**Package name:** `lmthing`
**Entry point:** `src/index.ts`
**Build output:** `dist/`
**Test framework:** Vitest

## Quick Reference

| Topic | Skill File |
|-------|-----------|
| Architecture, class hierarchy, exports, dependencies | [architecture.md](.claude/skills/architecture.md) |
| StatefulPrompt, defState, defEffect, re-execution | [stateful-prompt.md](.claude/skills/stateful-prompt.md) |
| def, defData, defSystem, defMessage, $, proxy methods | [context-functions.md](.claude/skills/context-functions.md) |
| defTool, defAgent, composite patterns, callbacks | [tools-and-agents.md](.claude/skills/tools-and-agents.md) |
| Provider system, model resolution, custom providers | [providers.md](.claude/skills/providers.md) |
| taskListPlugin (defTaskList) | [plugin-tasklist.md](.claude/skills/plugin-tasklist.md) |
| taskGraphPlugin (defTaskGraph, DAG) | [plugin-taskgraph.md](.claude/skills/plugin-taskgraph.md) |
| functionPlugin (defFunction, defFunctionAgent) | [plugin-function.md](.claude/skills/plugin-function.md) |
| zeroStepPlugin (defMethod, inline code execution) | [plugin-zerostep.md](.claude/skills/plugin-zerostep.md) |
| knowledgeAgentPlugin (defKnowledgeAgent, THING spaces) | [plugin-knowledge-agent.md](.claude/skills/plugin-knowledge-agent.md) |
| CLI (lmthing run, .lmt.mjs files) | [cli.md](.claude/skills/cli.md) |
| Testing, mock models, integration tests | [testing.md](.claude/skills/testing.md) |
| Langfuse observability, debug logging | [observability.md](.claude/skills/observability.md) |
| Development workflow, adding features, conventions | [development.md](.claude/skills/development.md) |

## Core Class Hierarchy

```
StreamTextBuilder (src/StreamText.ts)
       │
       ▼
  StatefulPrompt (src/StatefulPrompt.ts) - Main prompt class with all features
       │
       ▼
  runPrompt() (src/runPrompt.ts) - Main entry point (uses StatefulPrompt)
```

## Key Concepts

### 1. Variables (`def`, `defData`)

Variables are prepended to the system prompt as XML-tagged content. `def` stores strings, `defData` stores objects as YAML.

### 2. System Parts (`defSystem`)

Named system prompt sections formatted as XML tags. Multiple parts are concatenated.

### 3. Tools (`defTool`)

Tools map to the AI SDK's `tools` parameter. Support single tools, composite tools (array of sub-tools), response schemas, and callbacks (`beforeCall`, `onSuccess`, `onError`).

### 4. Agents (`defAgent`)

Agents are tools that spawn a child prompt with independent execution. Support response schema validation, custom models, composite agents (array of sub-agents).

### 5. State & Effects (`defState`, `defEffect`)

React-like hooks for managing state across prompt re-executions. State persists, effects run on dependency changes.

### 6. Template Literal (`$`)

Adds user messages: `prompt.$\`Help with ${topic}\``

## Built-in Plugins (Auto-Loaded)

All built-in plugins are automatically loaded on every `runPrompt()` call:

| Plugin | Method(s) | Purpose |
|--------|----------|---------|
| `taskListPlugin` | `defTaskList` | Simple flat task management |
| `taskGraphPlugin` | `defTaskGraph` | DAG-based task management with dependencies |
| `functionPlugin` | `defFunction`, `defFunctionAgent` | TypeScript-validated function execution in vm2 sandbox |
| `zeroStepPlugin` | `defMethod` | Inline `<run_code>` zero-step execution in text stream |
| `knowledgeAgentPlugin` | `defKnowledgeAgent` | THING space agent with knowledge injection and flow execution |

## Provider Support

8 built-in providers: OpenAI, Anthropic, Google, Mistral, Azure, Groq, Cohere, Bedrock.
Plus custom OpenAI-compatible providers via environment variables and model aliases.

## runPrompt Entry Point

```typescript
import { runPrompt } from 'lmthing';

const { result, prompt } = await runPrompt(
  async (prompt) => {
    const [count, setCount] = prompt.defState('counter', 0);
    prompt.defTool('increment', 'Increment counter',
      z.object({ amount: z.number() }),
      async ({ amount }) => { setCount(prev => prev + amount); return { newCount: count + amount }; }
    );
    prompt.$`Help me count things.`;
  },
  { model: 'openai:gpt-4o', options: { temperature: 0.7 } }
);

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Package Exports

```typescript
import { runPrompt, StatefulPrompt, tool, agent, PromptContext, StepModifier } from 'lmthing';
import { createMockModel } from 'lmthing/test';
import { taskListPlugin, taskGraphPlugin, functionPlugin, zeroStepPlugin, knowledgeAgentPlugin, func, funcAgent } from 'lmthing/plugins';
import { DebugLogger, getDebugLogger, createDebugLogger } from 'lmthing/logger';
import { setupLangfuse, createLangfuseTrace, buildTelemetry } from 'lmthing/observability';
```

## Error Classes

```typescript
import { LmthingError, ProviderError, ValidationError, PluginError, PromptError, ErrorCodes } from 'lmthing';
```

## Links

- [AI SDK Documentation](https://ai-sdk.dev/docs/reference/ai-sdk-core)
- [streamText Reference](./STREAM_TEXT.md)
- [Testing Guide](./TESTING.md)

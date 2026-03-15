# CLI — Running .lmt.mjs Prompt Files

## Overview

The CLI (`src/cli.ts`) allows running `.lmt.mjs` prompt files directly.

## Usage

```bash
npx lmthing run <file.lmt.mjs>
```

## File Format

`.lmt.mjs` files export:
- `default` (required) — Async function that receives the prompt methods
- `config` (required) — Configuration object with `model` property
- `mock` (optional) — Mock response array when using `model: 'mock'`

**All built-in plugins** (`defTaskList`, `defTaskGraph`, `defFunction`, `defFunctionAgent`, `defMethod`, `defKnowledgeAgent`) are automatically available.

```javascript
// myagent.lmt.mjs
export default async ({ def, defTool, defSystem, defTaskList, defFunction, $ }) => {
  defSystem('role', 'You are a helpful assistant.');
  const name = def('NAME', 'World');
  $`Say hello to ${name}`;
};

export const config = {
  model: 'openai:gpt-4o'
};
```

## Mock Model Support

When `config.model` is `'mock'`, the CLI uses the exported `mock` array. No imports needed.

```javascript
export const mock = [
  { type: 'text', text: 'Hello! ' },
  { type: 'text', text: 'How can I help you?' }
];

// With tool calls
export const mock = [
  { type: 'text', text: 'Let me calculate... ' },
  { type: 'tool-call', toolCallId: 'c1', toolName: 'calculator', args: { a: 1, b: 2 } },
  { type: 'text', text: 'The result is 3!' }
];

export default async ({ defTool, $ }) => {
  defTool('calculator', 'Add numbers', schema, async (args) => ({ sum: args.a + args.b }));
  $`Calculate 1 + 2`;
};

export const config = { model: 'mock' };
```

## CLI Architecture

```
CLI (src/cli.ts)
    │
    ├─► validateFile() - Check .lmt.mjs extension and file exists
    ├─► loadModule() - Dynamic import of the file
    ├─► Handle mock model
    │   └─► If config.model === 'mock', use createMockModel(module.mock)
    ├─► runPrompt(promptFn, config) - Execute the prompt
    └─► Stream output to stdout
```

## Examples

Examples in `examples/` directory:
- `mock-demo.lmt.mjs` — Simple mock model demo
- `mock-tools.lmt.mjs` — Tool usage with mock model
- `function-demo.lmt.mjs` — Function plugin with TypeScript validation
- `hello.lmt.mjs` — Real model example (requires API key)
- `weather.lmt.mjs` — Tool example with real model
- `multi-agent.lmt.mjs` — Agent orchestration example
- `data-analysis.lmt.mjs` — Data analysis with defData/defEffect
- `complex-stateful.lmt.mjs` — Complex stateful prompt demo
- `github-models.lmt.mjs` — GitHub Models API example
- `task-list.ts` — TypeScript task list example
- `fileRAGAgent.mjs` — File RAG agent example

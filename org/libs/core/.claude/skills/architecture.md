# Architecture & Core Class Hierarchy

## Overview

**lmthing** is a TypeScript library for building agentic AI workflows. It provides a high-level abstraction over the Vercel AI SDK's `streamText` function, enabling developers to create complex multi-agent systems with tools, hooks, and hierarchical prompts.

**Package name:** `lmthing`
**Entry point:** `src/index.ts`
**Build output:** `dist/`
**Test framework:** Vitest

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

## Key Components

| File | Purpose |
|------|---------|
| `src/StreamText.ts` | Low-level builder wrapping AI SDK's `streamText()` |
| `src/StatefulPrompt.ts` | Main prompt class with `def*` methods and React-like hooks (`defState`, `defEffect`) |
| `src/runPrompt.ts` | Entry point that orchestrates StatefulPrompt execution |
| `src/cli.ts` | CLI for running `.lmt.mjs` prompt files |
| `src/errors.ts` | Error classes (`LmthingError`, `ProviderError`, `ValidationError`, `PluginError`, `PromptError`) with error codes |
| `src/types/` | TypeScript interfaces organized by concern (`core.ts`, `collections.ts`, `tools.ts`, `agents.ts`, `effects.ts`, `plugins.ts`) |
| `src/providers/` | Provider adapters for OpenAI, Anthropic, Google, Mistral, Azure, Groq, Cohere, Bedrock |
| `src/providers/resolver.ts` | Model string resolution (`provider:model_id` → LanguageModel) |
| `src/providers/factory.ts` | Factory function for creating providers |
| `src/providers/custom.ts` | Custom OpenAI-compatible provider support |
| `src/plugins/` | Plugin system for extending StatefulPrompt |
| `src/plugins/taskList/` | Built-in task list plugin with `defTaskList` |
| `src/plugins/taskGraph/` | Built-in task graph (DAG) plugin with `defTaskGraph` |
| `src/plugins/function/` | Built-in function plugin with `defFunction`, `defFunctionAgent` |
| `src/plugins/zeroStep/` | Built-in zero-step plugin with `defMethod` |
| `src/plugins/knowledgeAgent/` | Built-in knowledge agent plugin with `defKnowledgeAgent` |
| `src/state/StateManager.ts` | Manages `defState` across re-executions |
| `src/effects/EffectsManager.ts` | Manages `defEffect` with dependency tracking |
| `src/definitions/DefinitionTracker.ts` | Tracks definition usage for reconciliation |
| `src/collections/` | Factory functions for tool, system, variable collections |
| `src/composite/CompositeExecutor.ts` | Handles composite tool/agent execution |
| `src/proxy/DefinitionProxy.ts` | Proxy objects returned by `def*` methods |
| `src/callbacks/CallbackExecutor.ts` | Executes tool callbacks (`beforeCall`, `onSuccess`, `onError`) |
| `src/logger/` | Debug logging with JSON and XML formatters |
| `src/observability/langfuse.ts` | Langfuse OpenTelemetry integration for tracing |

## Internal Architecture

StatefulPrompt delegates to specialized managers:

```
StatefulPrompt
    ├── _stateManager: StateManager
    │   └── Handles defState(), state storage, proxy creation
    │
    ├── _effectsManager: EffectsManager
    │   └── Handles defEffect(), dependency tracking, effect execution
    │
    ├── _definitionTracker: DefinitionTracker
    │   └── Tracks seen definitions, reconciles after re-execution
    │
    └── Uses collection utilities from src/collections/
        └── createToolCollection, createSystemCollection, createVariableCollection
```

## Data Flow

1. User calls `runPrompt(fn, config)` with a prompt function and configuration
2. `runPrompt` creates a `StatefulPrompt` instance, applies plugins, wraps in a Proxy for destructuring
3. Prompt function runs to set up definitions (tools, agents, state, effects, etc.)
4. `StatefulPrompt.run()` delegates to `StreamTextBuilder.execute()`
5. `StreamTextBuilder` calls Vercel AI SDK's `streamText()` with constructed arguments
6. On multi-step execution, `prepareStep` hooks re-run the prompt function, reconcile definitions, and apply effects
7. Results stream back to the caller

## Important Implementation Details

### Proxy in runPrompt

`runPrompt` wraps the StatefulPrompt in a Proxy to auto-bind methods, allowing destructuring:

```typescript
const { def, defState, defEffect, defTool, $ } = prompt; // Works due to proxy
```

### PrepareStep Hook Chain

Multiple hooks registered via `addPrepareStep()` execute sequentially with merged results:
1. StatefulPrompt's re-execution hook (runs prompt function again)
2. StatefulPrompt's effects hook (runs defEffect callbacks with stepModifier)
3. The `_lastPrepareStep` (set by Prompt.run()) executes last to inject variables

### stopWhen Default

`StreamTextBuilder.execute()` sets `stopWhen: stepCountIs(1000)` to prevent infinite loops. Override via `options.stopWhen`.

### Agent Response Processing

Middleware in `_getMiddleware()` transforms agent responses:
```typescript
// Agent returns: { response: "text", steps: [...] }
// Middleware transforms tool result to just the response text
```

## Package Exports

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./test": "./dist/test/createMockModel.js",
    "./plugins": "./dist/plugins/index.js",
    "./logger": "./dist/logger/index.js",
    "./observability": "./dist/observability/index.js"
  },
  "bin": {
    "lmthing": "./dist/cli.js"
  }
}
```

Usage:
```typescript
import { runPrompt, StatefulPrompt, tool, agent, PromptContext, StepModifier, ToolOptions, AgentOptions, ToolEventCallback } from 'lmthing';
import { createMockModel } from 'lmthing/test';
import { taskListPlugin, taskGraphPlugin, functionPlugin, zeroStepPlugin, knowledgeAgentPlugin } from 'lmthing/plugins';
import { DebugLogger, getDebugLogger, createDebugLogger } from 'lmthing/logger';
import { setupLangfuse, createLangfuseTrace, buildTelemetry } from 'lmthing/observability';
```

## Error Classes

```typescript
import { LmthingError, ProviderError, ValidationError, PluginError, PromptError, ErrorCodes } from 'lmthing';

// ErrorCodes: UNKNOWN_PROVIDER, MISSING_API_KEY, MISSING_API_BASE,
//             PROVIDER_NOT_CONFIGURED, INVALID_CONFIG, INVALID_SCHEMA,
//             MISSING_REQUIRED, MODEL_REQUIRED, EXECUTION_FAILED,
//             PLUGIN_INIT_FAILED, PLUGIN_METHOD_FAILED
```

## Dependencies

### Runtime
- `ai` (^6.0.86) - Vercel AI SDK core
- `@ai-sdk/openai-compatible` (^2.0.30) - OpenAI-compatible provider support
- `@ai-sdk/provider` (^3.0.8) - AI SDK provider interface
- `zod` (^4.1.13) - Schema validation
- `js-yaml` (^4.1.1) - YAML serialization
- `zod-to-ts` (^2.0.0) - Converts Zod schemas to TypeScript type nodes
- `vm2` (^3.9.19) - Sandboxed code execution (peer dep)
- `@ai-sdk/*` provider packages - Provider SDKs (peer deps)

### Development
- `vitest` (^4.1.0) - Test framework
- `typescript` (^5.5.4) - Compiler
- `esbuild` (^0.27.1) - CLI bundler
- `msw` (^2.12.4) - Mock service worker
- `@langfuse/otel` + `@opentelemetry/sdk-trace-node` - Observability

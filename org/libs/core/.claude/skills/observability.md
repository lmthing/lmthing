# Observability — Langfuse Integration

## Overview

The observability module provides Langfuse OpenTelemetry integration for tracing `runPrompt` executions. Located in `src/observability/langfuse.ts`.

## Setup

```typescript
import { setupLangfuse } from 'lmthing/observability';

// Call once at application start-up
setupLangfuse();
// Or with explicit credentials:
setupLangfuse({
  secretKey: 'sk-...',
  publicKey: 'pk-...',
  baseUrl: 'https://cloud.langfuse.com'
});
```

Credentials are resolved from options first, then environment variables:
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_BASEURL`

## Grouping Multiple Executions

Create a parent trace to group multiple `runPrompt` calls:

```typescript
import { setupLangfuse, createLangfuseTrace, buildTelemetry } from 'lmthing/observability';

setupLangfuse();

const { traceId, flushAsync } = createLangfuseTrace('my-workflow');

for (let i = 0; i < 3; i++) {
  await runPrompt(async ({ $ }) => {
    $`Step ${i}`;
  }, {
    model: 'openai:gpt-4o',
    options: {
      experimental_telemetry: buildTelemetry(`step-${i}`, traceId),
    },
  });
}

await flushAsync();
```

## API

### `setupLangfuse(options?)`

Initializes the Langfuse OpenTelemetry span processor. Call once before any `runPrompt` calls.

### `createLangfuseTrace(name, options?)`

Creates a parent trace. Returns `{ traceId, flushAsync }`.

### `buildTelemetry(functionId, traceId, opts?)`

Builds the `experimental_telemetry` configuration object for a single `runPrompt` call.

Options:
- `recordInputs?: boolean` — Whether to record inputs (default: true)
- `recordOutputs?: boolean` — Whether to record outputs (default: true)

## Debug Logging

The logger module (`src/logger/`) provides structured debug logging:

```typescript
import { DebugLogger, getDebugLogger, createDebugLogger } from 'lmthing/logger';
```

Supports JSON and XML formatting for system prompts.

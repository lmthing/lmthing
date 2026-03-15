# functionPlugin — TypeScript-Validated Function Execution

## Overview

The built-in function plugin provides `defFunction` and `defFunctionAgent` for defining functions the LLM can call via TypeScript code execution. Unlike `defTool` (JSON arguments), functions are called through TypeScript code with compile-time type checking. It is **auto-loaded**.

**Source:** `src/plugins/function/`

## defFunction — Single Function

```typescript
import { runPrompt } from 'lmthing';
import { z } from 'zod';

const { result } = await runPrompt(async ({ defFunction, $ }) => {
  defFunction(
    'calculate', 'Add two numbers',
    z.object({ a: z.number(), b: z.number() }),
    async ({ a, b }) => ({ sum: a + b }),
    {
      responseSchema: z.object({ sum: z.number() }),
      beforeCall: async (input) => { return undefined; },
      onSuccess: async (input, output) => { return undefined; },
      onError: async (input, error) => { return { fallback: true }; }
    }
  );

  $`Calculate 5 + 3 using the calculate function.`;
}, { model: 'openai:gpt-4o' });

// LLM calls via:
// const result = await calculate({ a: 5, b: 3 });
// console.log(result.sum); // 8
```

## defFunction — Composite Functions (Namespaces)

```typescript
import { func } from 'lmthing/plugins';

defFunction('math', 'Mathematical operations', [
  func('add', 'Add numbers', z.object({ a: z.number(), b: z.number() }),
    async ({ a, b }) => ({ result: a + b }),
    { responseSchema: z.object({ result: z.number() }) }
  ),
  func('multiply', 'Multiply numbers', z.object({ a: z.number(), b: z.number() }),
    async ({ a, b }) => ({ result: a * b }),
    { responseSchema: z.object({ result: z.number() }) }
  )
]);

// LLM calls via:
// const sum = await math.add({ a: 5, b: 3 });
// const product = await math.multiply({ a: 4, b: 7 });
```

## defFunctionAgent — Agents Called via TypeScript

Works like `defFunction` but spawns child agents.

**Single:**
```typescript
defFunctionAgent(
  'researcher', 'Research topics',
  z.object({ topic: z.string() }),
  async ({ topic }, agentPrompt) => { agentPrompt.$`Research: ${topic}`; },
  { model: 'openai:gpt-4o', responseSchema: z.object({ findings: z.array(z.string()) }) }
);
```

**Composite:**
```typescript
import { funcAgent } from 'lmthing/plugins';

defFunctionAgent('specialists', 'Specialist agents', [
  funcAgent('researcher', 'Research topics', z.object({ topic: z.string() }),
    async ({ topic }, prompt) => { prompt.$`Research: ${topic}`; },
    { responseSchema: z.object({ findings: z.array(z.string()) }) }
  ),
  funcAgent('analyst', 'Analyze data', z.object({ data: z.string() }),
    async ({ data }, prompt) => { prompt.$`Analyze: ${data}`; },
    { responseSchema: z.object({ summary: z.string(), score: z.number() }) }
  )
]);
```

## How It Works

1. `defFunction` registers functions in a `FunctionRegistry`
2. Automatically creates a `runToolCode` tool with TypeScript validation
3. LLM writes TypeScript code calling registered functions
4. Code validated against generated type declarations (`typeGenerator.ts`)
5. If valid, executes in sandboxed environment (vm2 via `sandbox.ts`)
6. Results returned to LLM

## TypeScript Validation

Generated type declarations:
```typescript
declare function calculate(args: { a: number; b: number }): Promise<{ sum: number }>;
declare namespace math {
  function add(args: { a: number; b: number }): Promise<{ result: number }>;
  function multiply(args: { a: number; b: number }): Promise<{ result: number }>;
}
```

If the LLM writes invalid TypeScript, validation fails and error messages guide correction.

## Security

- Code execution sandboxed using vm2
- Only registered functions accessible
- No file system, network, or Node.js API access unless explicitly provided
- TypeScript validation catches errors before execution

## Internal Architecture

| File | Purpose |
|------|---------|
| `FunctionPlugin.ts` | Main plugin implementation |
| `FunctionRegistry.ts` | Registry for tracking functions |
| `typeGenerator.ts` | Generates TypeScript declarations from Zod schemas |
| `typeChecker.ts` | TypeScript validation using ts-morph |
| `sandbox.ts` | vm2 sandboxed code execution |
| `types.ts` | Type definitions |

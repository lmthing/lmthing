# zeroStepPlugin — Inline Code Execution (defMethod)

## Overview

The built-in zero-step plugin provides `defMethod()` for Zero-Step Tool Calling — the LLM calls registered functions **inline in its text stream** via `<run_code>` blocks, with no tool-call round-trip. It is **auto-loaded**.

**Source:** `src/plugins/zeroStep/`

## Signature

```typescript
defMethod(name, description, parameterSchema, handler, responseSchema)
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Method name used inside `<run_code>` code |
| `description` | `string` | Human-readable description included in the system prompt |
| `parameterSchema` | `z.ZodType<TInput>` | Zod schema for validating input arguments |
| `handler` | `(args: TInput) => TOutput \| Promise<TOutput>` | Implementation function |
| `responseSchema` | `z.ZodType<TOutput>` | Zod schema for validating the return value |

## Example

```typescript
import { runPrompt } from 'lmthing';
import { z } from 'zod';

const { result } = await runPrompt(async ({ defMethod, $ }) => {
  defMethod(
    'fetchUser',
    'Fetch a user record by ID',
    z.object({ id: z.string() }),
    async ({ id }) => ({ name: 'Jane', role: 'Admin' }),
    z.object({ name: z.string(), role: z.string() })
  );

  $`Who is user 42? Call fetchUser to find out.`;
}, { model: 'openai:gpt-4o' });

// LLM response might contain:
// I'll look that up for you:
// <run_code>
//   const user = await fetchUser({ id: "42" });
//   return user.name;
// </run_code>
//
// Stream transformer replaces that block with:
//   <code_response>Jane</code_response>
```

## Execution Scenarios

| Scenario | Trigger | Stream output |
|---|---|---|
| **A — return** | `return` statement reached (line-by-line early detection) | `<code_response>value</code_response>`, stream halted |
| **B — no return** | `</run_code>` closing tag reached with no `return` | Nothing emitted; streaming continues normally |
| **C — error** | TypeScript type error or runtime exception | `<code_error>message</code_error>`, stream halted |

## TypeScript Type Checking

Every `<run_code>` block is validated against TypeScript declarations generated from Zod schemas before sandbox execution:

```typescript
// Auto-generated declarations:
declare function fetchUser(args: { id: string }): Promise<{ name: string; role: string }>;

// This code fails before execution:
// const u = await fetchUser({ id: 123 }); // TS2322: number not assignable to string
```

The generated signature also appears in the system prompt so the LLM knows the exact types.

## Key Differences from defFunction

- **defMethod**: LLM writes `<run_code>` blocks inline in text stream (zero round-trips)
- **defFunction**: LLM uses standard tool calls via `runToolCode` tool (requires tool-call round-trip)

## Internal Architecture

| File | Purpose |
|---|---|
| `types.ts` | `MethodDefinition<TInput, TOutput>` interface |
| `MethodRegistry.ts` | Stores registered method definitions by name |
| `typeGenerator.ts` | Converts Zod schemas → `declare function` TS strings via `zod-to-ts` |
| `typeChecker.ts` | Validates TypeScript code against declarations; returns `TypeCheckResult` with errors |
| `streamProcessor.ts` | `ReadableStream` state-machine transformer (PASSTHROUGH ↔ CODE_BLOCK); runs type check then vm2 sandbox on each complete line |
| `ZeroStepPlugin.ts` | `defMethod` plugin function; wires transformer once per instance; builds system prompt |

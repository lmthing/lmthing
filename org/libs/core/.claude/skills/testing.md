# Testing — Mock Models, Unit & Integration Tests

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Mock Model Usage

```typescript
import { createMockModel } from 'lmthing/test';

const mockModel = createMockModel([
  { type: 'text', text: 'Hello!' },
  { type: 'tool-call', toolCallId: 'call_1', toolName: 'search', args: { q: 'test' } },
  { type: 'text', text: 'Found results!' }
]);
```

**Key behaviors:**
- Text items emit as text deltas
- Tool calls pause the stream and return control to AI SDK
- Each `doStream` call advances through content until next tool call
- Maintains state across multiple calls (multi-step execution)

## Test File Locations

- `src/*.test.ts` — Unit tests for main classes
- `src/state/*.test.ts` — StateManager tests
- `src/effects/*.test.ts` — EffectsManager tests
- `src/definitions/*.test.ts` — DefinitionTracker tests
- `src/collections/*.test.ts` — Collection utility tests
- `src/providers/*.test.ts` — Provider-specific tests
- `src/test/` — Test utilities

## Snapshot Testing

Tests use Vitest snapshots (`expect(steps).toMatchSnapshot()`). Update snapshots:

```bash
npm test -- -u
```

## Integration Tests

Integration tests use real LLM APIs. Opt-in via environment variable.

```bash
LM_TEST_MODEL=openai:gpt-4o-mini npm test -- --run tests/integration
LM_TEST_MODEL=anthropic:claude-3-5-sonnet-20241022 npm test -- --run tests/integration
```

**Integration test files:**
- `tests/integration/defAgent.test.ts`
- `tests/integration/defFunction.test.ts`
- `tests/integration/defHooks.test.ts`
- `tests/integration/defMethod.test.ts`
- `tests/integration/defTaskList.test.ts`
- `tests/integration/defTaskGraph.test.ts`
- `tests/integration/defTool.test.ts`
- `tests/integration/defVariables.test.ts`

**Test configuration:**
- Requires `LM_TEST_MODEL` environment variable
- Default timeout is 90 seconds for LLM calls
- Tests are skipped if no model is configured

## Test Tool Calls

```typescript
const toolFn = vi.fn().mockResolvedValue({ result: 'ok' });
// ...setup with mock model that calls the tool...
expect(toolFn).toHaveBeenCalledWith(
  { expectedArgs: 'value' },
  expect.anything() // ToolExecutionOptions
);
```

## Debug Step Execution

```typescript
const { result, prompt } = await runPrompt(...);
await result.text; // Wait for completion
console.log(prompt.steps);     // Simplified view
console.log(prompt.fullSteps); // Raw chunks
```

## Step Tracking

The `StreamTextBuilder` wraps the model with middleware that:
1. Captures all stream chunks per step
2. Processes agent tool results (extracts response text)
3. Exposes via `prompt.steps` (simplified) and `prompt.fullSteps` (raw)

**Step structure:**
```typescript
{
  input: {
    prompt: [{ role, content }...]
  },
  output: {
    content: [{ type: 'text'|'tool-call', ... }],
    finishReason: 'stop'|'tool-calls'
  }
}
```

# Development Workflow & Code Conventions

## Build

```bash
npm run build      # TypeScript compile + bundle CLI
npm run build:cli  # Bundle CLI only (esbuild)
npm run dev        # Watch mode (tsc only)
```

The build process:
1. `tsc` compiles TypeScript to `dist/`
2. `esbuild` bundles `src/cli.ts` into `dist/cli.js` with external dependencies

## Adding a New Context Method (`def*`)

1. Add method to `StatefulPrompt` class in `src/StatefulPrompt.ts`
2. For specialized functionality:
   - State-related: extend `StateManager` in `src/state/`
   - Effect-related: extend `EffectsManager` in `src/effects/`
   - Definition tracking: update `DefinitionTracker` in `src/definitions/`
3. Store state in protected instance variables
4. Process in `run()` via `setLastPrepareStep()` if needed
5. Add tests in `src/Prompt.test.ts` and unit tests for any new manager

## Adding Configuration Options

Options flow through `StreamTextBuilder.withOptions()` and merge into `streamText()` call. Excluded options (handled internally): `model`, `system`, `messages`, `tools`, `onFinish`, `onStepFinish`, `prepareStep`.

## Creating Custom Plugins

```typescript
import type { StatefulPrompt } from 'lmthing';

export function defCustomFeature(this: StatefulPrompt, config: Config) {
  const [state, setState] = this.defState('customState', initialValue);
  this.defTool('customTool', 'description', schema, handler);
  this.defEffect((ctx, step) => { /* ... */ }, [state]);
  return [state, setState];
}

export const customPlugin = { defCustomFeature };

// Usage:
runPrompt(({ defCustomFeature, $ }) => {
  defCustomFeature({ option: 'value' });
  $`Use the custom tool...`;
}, { model: 'openai:gpt-4o', plugins: [customPlugin] });
```

**Plugin architecture:**
- Plugin methods receive `StatefulPrompt` as `this` context
- Methods are pre-bound during `setPlugins()` call
- Available through the prompt function's destructured arguments
- Can use all StatefulPrompt methods (`defState`, `defTool`, `defEffect`, etc.)

## Code Style & Conventions

- **TypeScript strict mode** enabled
- **ES2022 target** with ES module syntax
- **Zod** for schema validation (tools, agents)
- **js-yaml** for data serialization in variables
- **No classes for configuration** — use interfaces and factory functions
- **Fluent builder pattern** in StreamTextBuilder

## Troubleshooting

### "Model is required to execute streamText"
Ensure model is passed to `runPrompt` config or `new Prompt(model)`.

### Tool not being called
Check tool name matches between `defTool` and mock model's `toolName`.

### Variables not appearing in system prompt
Variables are injected in `prompt.run()` via `setLastPrepareStep()`. Ensure `run()` is called (automatic in `runPrompt`).

### Custom provider not found
Verify environment variables:
- `{NAME}_API_KEY` is set
- `{NAME}_API_BASE` is set
- `{NAME}_API_TYPE=openai` (required flag)

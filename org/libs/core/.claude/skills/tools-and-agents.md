# Tools & Agents — defTool, defAgent, Composite Patterns

## defTool — Single Tool

Registers a tool mapped to the `tools` parameter in `streamText`.

```typescript
prompt.defTool(
  'search',
  'Search for information',
  z.object({ query: z.string() }),
  async (args) => {
    return await performSearch(args.query);
  }
);
```

**Tool Execution Context** (second parameter):
- `toolCallId`: The ID of the tool call
- `messages`: Messages sent to the model for this response
- `abortSignal`: Signal for canceling the operation

```typescript
prompt.defTool(
  'longRunningTask',
  'Performs a task that can be cancelled',
  z.object({ data: z.string() }),
  async (args, { toolCallId, messages, abortSignal }) => {
    return await performTask(args.data, abortSignal);
  }
);
```

## defTool — Composite Tools

When an array of sub-tool definitions is provided, creates a single composite tool for multiple sub-tools in one call.

```typescript
import { tool } from 'lmthing';

prompt.defTool('file', 'File system operations', [
  tool('write', 'Write content to a file', z.object({
    path: z.string(), content: z.string()
  }), async ({ path, content }) => {
    await fs.writeFile(path, content);
    return { success: true };
  }),
  tool('read', 'Read content from a file', z.object({
    path: z.string()
  }), async ({ path }) => {
    return { content: await fs.readFile(path, 'utf-8') };
  })
]);
```

**LLM calls with:** `{ calls: [{ name: "write", args: {...} }, { name: "read", args: {...} }] }`

**Returns:** `{ results: [{ name: "write", result: {...} }, { name: "read", result: {...} }] }`

Errors per sub-tool are captured in results without stopping other sub-tools.

**Implementation:** Uses `z.union()` for discriminated union schema; executes sub-tools sequentially.

## Tool Options — Response Schema & Callbacks

Both single and composite tools support response schema and event callbacks:

```typescript
prompt.defTool(
  'calculate', 'Calculate numbers',
  z.object({ a: z.number(), b: z.number() }),
  async ({ a, b }) => ({ result: a + b }),
  {
    responseSchema: z.object({ result: z.number() }),
    beforeCall: async (input, output) => {
      console.log('Executing with:', input);
      return undefined; // Continue; return value to short-circuit
    },
    onSuccess: async (input, output) => {
      console.log('Succeeded:', output);
      return undefined; // Keep original; return value to replace
    },
    onError: async (input, error) => {
      console.log('Failed:', error);
      return { fallback: true }; // Recovery value
    }
  }
);
```

For composite tools, each sub-tool's callbacks are executed independently.

## defAgent — Single Agent

Registers a sub-agent as a callable tool with independent execution context.

```typescript
prompt.defAgent(
  'researcher', 'Research topics',
  z.object({ topic: z.string() }),
  async (args, childPrompt) => {
    childPrompt.$`Research: ${args.topic}`;
  },
  {
    model: 'openai:gpt-4o',        // Override model
    system: 'You are a researcher.', // Custom system prompt
    plugins: [customPlugin],         // Additional plugins
    responseSchema: z.object({       // Structured output validation
      summary: z.string(),
      score: z.number()
    })
  }
);
```

**Response Schema Behavior:**
1. Agent receives instructions to respond with valid JSON matching the schema
2. Schema is converted to JSON Schema and included in the agent's system prompt
3. Response is validated after execution
4. If validation fails, response includes `validationError` field

**Agent execution flow:**
1. Parent model calls agent tool
2. New `Prompt` created with specified/inherited model
3. If `responseSchema` provided, schema instructions added to system prompt
4. User's callback configures the child prompt
5. Child `prompt.run()` executes
6. Response validated against schema if provided
7. Returns `{ response: text, steps: [...], validationError?: string }` to parent

## defAgent — Composite Agents

When an array of sub-agent definitions is passed, creates a single composite agent.

```typescript
import { agent } from 'lmthing';

prompt.defAgent('specialists', 'Specialist agents', [
  agent('researcher', 'Research topics', z.object({ topic: z.string() }),
    async ({ topic }, agentPrompt) => {
      agentPrompt.$`Research: ${topic}`;
    },
    { model: 'openai:gpt-4o', responseSchema: z.object({ findings: z.array(z.string()) }) }
  ),
  agent('analyst', 'Analyze data', z.object({ data: z.string() }),
    async ({ data }, agentPrompt) => {
      agentPrompt.$`Analyze: ${data}`;
    },
    { responseSchema: z.object({ summary: z.string(), score: z.number() }) }
  )
]);
```

Each sub-agent can have its own `responseSchema`, `system`, `model`, and other options. Sub-agents execute sequentially with errors captured per agent.

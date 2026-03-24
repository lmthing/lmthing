# Phase 1a: Spawn Infrastructure

## Context

Phase 1a from NEXT.md — the foundation for all agent spawning. Spawned child agents need their own Session + AgentLoop, context branching ("empty" vs "branch"), and structured output. This phase is internal infrastructure only — no user-facing `spawn()` global. Phase 1b will add the agent namespace API on top.

---

## New File

### 1. `src/sandbox/spawn.ts` — SpawnConfig, child session factory, execution

**Types:**

```ts
interface SpawnConfig {
  directive: string;
  context: "empty" | "branch";
  maxTurns?: number; // default: 5
  instruct?: string; // appended to child system prompt
}

interface SpawnResult {
  scope: string;
  result: unknown;
  keyFiles: string[];
  issues?: string[];
  _raw?: Record<string, unknown>; // last stop payload
  _meta: { context: "empty" | "branch"; turns: number; duration: number };
}

interface SpawnContext {
  model: LanguageModel;
  modelId: string;
  messages: ChatMessage[]; // parent's messages (for 'branch')
  scopeTable: string; // parent's current SCOPE
  catalogGlobals: Record<string, unknown>;
  functionSignatures: string;
  formSignatures: string;
  viewSignatures: string;
  classSignatures: string;
  knowledgeTree: string;
  knowledgeLoader?: SessionOptions["knowledgeLoader"];
  getClassInfo?: SessionOptions["getClassInfo"];
  loadClass?: SessionOptions["loadClass"];
  parentSession: Session;
}
```

**`executeSpawn(config: SpawnConfig, ctx: SpawnContext): Promise<SpawnResult>`**

Steps:

1. Generate `childId = spawn_${Date.now()}_${random}`
2. Emit `spawn_start` on `ctx.parentSession`
3. Create child `Session` with parent's full catalog globals, knowledge loader, class info
4. Build child instruct — prepend structured output requirement + parent scope table
5. Create child `AgentLoop` with parent's `model` ref, child instruct, parent's function signatures
6. If `context === 'branch'` → deep clone parent messages via `structuredClone(ctx.messages)`, set on child AgentLoop before `handleMessage`
7. Call `childAgentLoop.handleMessage(config.directive)`
8. Extract last stop payload from child session messages, build `SpawnResult`
9. Emit `spawn_complete` (or `spawn_error` on failure)
10. `childSession.destroy()` in finally block
11. Return `SpawnResult`

**Child system prompt addition** (prepended to instruct):

```
You are a spawned agent. Focus exclusively on the directive.

Parent's current scope:
${scopeTable}

Your final stop() call MUST include: await stop({ scope: <summary>, result: <findings>, keyFiles: [<paths>], issues: [<problems>] })
```

**Structured output extraction:**

- Parse child session's messages for the last `← stop { ... }` user message
- Extract payload keys, map to SpawnResult fields
- If child completes without conforming stop → wrap available data as best-effort result

---

## Modified Files

### 2. `src/session/types.ts` — Add 3 spawn event types

Add to the `SessionEvent` union:

```ts
| { type: 'spawn_start'; childId: string; context: string; directive: string }
| { type: 'spawn_complete'; childId: string; turns: number; duration: number }
| { type: 'spawn_error'; childId: string; error: string }
```

### 3. `src/session/session.ts` — Add `onSpawn` to SessionOptions

```ts
export interface SessionOptions {
  // ...existing...
  onSpawn?: (config: SpawnConfig) => Promise<SpawnResult>;
}
```

Store as private field. Hook point for Phase 1b to wire agent namespaces through.

### 4. `src/cli/agent-loop.ts` — Add `handleSpawn()` + store refs

**New fields on `AgentLoopOptions`:**

```ts
catalogGlobals?: Record<string, unknown>
knowledgeLoader?: SessionOptions['knowledgeLoader']
getClassInfo?: SessionOptions['getClassInfo']
loadClass?: SessionOptions['loadClass']
```

**New private fields** on `AgentLoop` class — same as above, stored from constructor.

**New public method: `handleSpawn(config: SpawnConfig): Promise<SpawnResult>`**

- Builds `SpawnContext` from stored references
- Calls `executeSpawn(config, ctx)`
- Returns result

**New public method: `setMessages(messages: ChatMessage[])`**

- Replaces the internal `messages` array
- Used by `executeSpawn()` to inject cloned parent messages into child AgentLoop
- Only called before the first `handleMessage()` on a child AgentLoop

### 5. `src/cli/run-agent.ts` — Pass refs through

Pass to AgentLoop constructor:

```ts
const agentLoop = new AgentLoop({
  // ...existing...
  catalogGlobals,
  knowledgeLoader,
  getClassInfo,
  loadClass,
});
```

~4 new lines. These references are already available as local variables/closures in `runAgent()`.

---

## Implementation Order

1. **`src/session/types.ts`** — Add 3 event types (pure additive)
2. **`src/session/session.ts`** — Add `onSpawn` to SessionOptions (1 field)
3. **`src/cli/agent-loop.ts`** — Add fields, `handleSpawn()`, `setMessages()` (additive)
4. **`src/sandbox/spawn.ts`** + **`src/sandbox/spawn.test.ts`** — Core spawn logic
5. **`src/cli/run-agent.ts`** — Wire refs through

---

## Test Plan

### `src/sandbox/spawn.test.ts`

- Mock `LanguageModel` using Vercel AI SDK test patterns
- **"empty" context**: child starts with no prior messages, receives directive
- **"branch" context**: child starts with cloned parent messages
- **Structured output**: last stop payload mapped to SpawnResult fields
- **Cleanup**: child session destroyed after completion
- **Events**: `spawn_start`, `spawn_complete` emitted on parent session
- **Error handling**: `spawn_error` emitted when child throws

### Run existing tests

```bash
cd /home/vasilis/GEANT/lmthing/org/libs/repl && npx vitest run
```

Verify no regressions — all changes are additive.

---

## Key Reuse Points

| What                   | Where                            | How it's reused                                               |
| ---------------------- | -------------------------------- | ------------------------------------------------------------- |
| `Session` class        | `src/session/session.ts`         | Child gets its own Session instance                           |
| `AgentLoop` class      | `src/cli/agent-loop.ts`          | Child gets its own AgentLoop instance                         |
| `buildSystemPrompt()`  | `src/cli/buildSystemPrompt.ts`   | Child system prompt built same way                            |
| `generateScopeTable()` | `src/context/scope-generator.ts` | Parent scope injected into child instruct                     |
| Test patterns          | `src/sandbox/globals.test.ts`    | Mock `StreamPauseController`, `RenderSurface`, `AsyncManager` |

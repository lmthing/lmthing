# Testing Guide

This document describes how every feature in `@lmthing/repl` and `lmthing` (core) is tested, with emphasis on real-LLM integration tests.

---

## Model Aliases

Both packages load `.env` at startup. Two aliases are pre-configured:

| Alias | Env var | Resolves to |
|-------|---------|-------------|
| `"small"` | `LM_MODEL_SMALL` | `azure:gpt-5.4-nano` |
| `"large"` | `LM_MODEL_LARGE` | `zai:glm-4.5` |

`resolveModel("small")` reads `LM_MODEL_SMALL` and resolves the provider chain. Tests that call real LLMs pass `model: "small"` or `model: "large"` — no hardcoded model strings.

---

## Snapshot Policy

**Every test that constructs a system prompt or executes code in a sandbox must snapshot both.** Snapshots are stored in `__snapshots__/` alongside each test file and committed to git. They give reviewers a versioned, human-readable record of the exact inputs sent to models and the resulting sandbox state — the primary audit trail for debugging regressions.

### What gets snapshotted

| Test type | Snapshot subject | API |
|-----------|-----------------|-----|
| System prompt building | The full prompt string | `expect(prompt).toMatchSnapshot()` |
| Sandbox execution (unit) | `sandbox.getScope()` after execute | `expect(sandbox.getScope()).toMatchSnapshot()` |
| LLM round-trip | `{ systemPrompt, userPrompt, generatedCode }` before execution | `expect({ systemPrompt, userPrompt, generatedCode }).toMatchSnapshot()` |
| LLM round-trip | `sandbox.getScope()` after execution | `expect(sandbox.getScope()).toMatchSnapshot()` |
| Session-based tests | `session.getMessages()` (full message array) | `expect(session.getMessages()).toMatchSnapshot()` |
| THING integration | `session.getMessages()` + `session.getConversationState()` | snapshot both separately |

### Snapshot naming convention

Vitest names each snapshot by test description. Use the `[small]` / `[large]` prefix from the model loop so each model's snapshot is stored separately:

```
// globals-llm.test.ts snapshots/
[small] stop: can call stop() with a value — systemPrompt
[small] stop: can call stop() with a value — scope
[large] stop: can call stop() with a value — systemPrompt
[large] stop: can call stop() with a value — scope
```

### Inline snapshot pattern (unit tests)

For deterministic unit tests, use `toMatchInlineSnapshot()` so the expected value lives next to the assertion and is reviewable in a single diff:

```ts
it('buildSystemPrompt inserts scope correctly', () => {
  const prompt = buildSystemPrompt(template, { SCOPE: 'x: number = 42' })
  expect(prompt).toMatchInlineSnapshot(`
    "You are an agent.

    ## Variables
    x: number = 42

    ## Rules"
  `)
})
```

### File snapshot pattern (LLM tests and session tests)

For variable or multi-line content, use `toMatchSnapshot()`. The `.snap` file is the source of truth. Re-run with `--update-snapshots` when an intentional change is made:

```ts
it('[small] stop: can call stop() with a value', async () => {
  const systemPrompt = makeSystemPrompt(STOP_DOCS)
  const generatedCode = extractCode(await askLlm('small', systemPrompt, task))

  // Snapshot everything sent to and returned from the model
  expect({ systemPrompt, userPrompt: task, generatedCode }).toMatchSnapshot()

  // Execute and snapshot resulting sandbox state
  const sb = new Sandbox()
  const stopFn = vi.fn().mockResolvedValue(undefined)
  sb.inject('stop', stopFn)
  await sb.execute(generatedCode)

  expect(sb.getScope()).toMatchSnapshot()

  // Functional assertion
  expect(stopFn).toHaveBeenCalledWith(42)
})
```

### Session snapshot pattern

For session-based tests, snapshot the full message array so the system prompt and every turn are visible:

```ts
await session.handleUserMessage('Analyse this')
for await (const chunk of stream) await session.feedToken(chunk)
await session.finalize()

expect(session.getMessages()).toMatchSnapshot()           // prompts + turns
expect(session.getConversationState()).toMatchSnapshot()  // scope deltas + events
```

### Updating snapshots

```bash
# Update all snapshots in one package
pnpm vitest run --update-snapshots

# Update snapshots for one file only
pnpm vitest run src/sandbox/globals-llm.test.ts --update-snapshots
```

Always commit snapshot updates in their own commit with a message describing why the output changed (e.g. `chore: update snapshots after stop() doc clarification`).

---

## Running Tests

```bash
# All unit tests (no LLM calls, fast)
cd org/libs/repl && pnpm test
cd org/libs/core && pnpm test

# LLM integration tests only (repl)
cd org/libs/repl && pnpm vitest run src/sandbox/globals-llm.test.ts

# THING agent integration tests (core)
cd org/libs/core && pnpm vitest run src/thing-agent.test.ts

# Space tests via lmthing test (see below)
lmthing test --space org/libs/thing/spaces/space-creator
lmthing test --space org/libs/thing/spaces/space-creator --model small

# Watch mode (development)
pnpm test:watch
```

---

## Space Tests — `lmthing test`

Every space in `org/libs/thing/spaces/` ships with a `tests/` directory containing a vitest test file. The `lmthing test` subcommand discovers all `*.test.ts` files inside a space directory and runs them with vitest.

### Command

```bash
lmthing test --space <path>                         # run all tests in the space
lmthing test --space <path> --model small           # hint for future model-specific logic
lmthing test --space ./a --space ./b                # multiple spaces in one run
```

`lmthing test` discovers test files, finds the nearest `node_modules/.bin/vitest`, sets `cwd` to the monorepo root so workspace packages resolve, and forwards all env vars (API keys, model aliases) to the subprocess.

### Implementation

| File | Purpose |
|------|---------|
| `org/libs/core/src/cli/args.ts` | `command: 'run' | 'test'`; `testPattern?`; `--pattern` flag; validates `--space` required for test |
| `org/libs/core/src/cli/test-runner.ts` | `collectTestFiles()` — recursive `*.test.ts` walk; `findVitestBin()` — walks up to monorepo root; `runSpaceTests()` — spawns vitest |
| `org/libs/core/src/cli/bin.ts` | `if (args.command === 'test') → runSpaceTests(args.spaces, ...)` branch |

### Space test files

Each test file has two sections:

**Structure tests** (fast, no LLM, always run):
- `package.json` exists and has correct `name`
- Each `agents/agent-*/config.json` exists and parses as valid JSON
- Each `agents/agent-*/instruct.md` exists and has YAML frontmatter with `name:`
- Each `flows/flow_*/index.md` exists
- Each `flows/flow_*/` has at least one numbered step `.md` file
- Each `knowledge/{domain}/config.json` exists

**LLM integration tests** (skipped when `AZURE_API_KEY` and `ZAI_API_KEY` are absent):
- One test per agent per model size (`small`, `large`)
- Runs the agent's instruct.md through a real `AgentLoop` + `Session`
- Sends a representative prompt specific to the agent's role
- Snapshots `session.getMessages()` and `session.getConversationState()`
- Asserts `state.stopCount > 0` (agent called `stop()` at least once)

### Space test coverage

| Space | Test file | Agents tested |
|-------|-----------|---------------|
| `space-creator` | `tests/space-creator.test.ts` | SpaceArchitect |
| `space-ecosystem` | `tests/space-ecosystem.test.ts` | PlatformGuide, AccountManager |
| `space-studio` | `tests/space-studio.test.ts` | AgentBuilder, PromptCoach |
| `space-chat` | `tests/space-chat.test.ts` | ChatAssistant |
| `space-computer` | `tests/space-computer.test.ts` | ComputerAdmin, Troubleshooter |
| `space-deploy` | `tests/space-deploy.test.ts` | DeployManager, SpaceMonitor |
| `space-store` | `tests/space-store.test.ts` | StoreCurator, ListingOptimizer |

### Running all THING spaces at once

```bash
# All 7 spaces in one vitest run
lmthing test \
  --space org/libs/thing/spaces/space-creator \
  --space org/libs/thing/spaces/space-ecosystem \
  --space org/libs/thing/spaces/space-studio \
  --space org/libs/thing/spaces/space-chat \
  --space org/libs/thing/spaces/space-computer \
  --space org/libs/thing/spaces/space-deploy \
  --space org/libs/thing/spaces/space-store
```

Structure tests only (no API key needed):

```bash
AZURE_API_KEY= ZAI_API_KEY= lmthing test --space org/libs/thing/spaces/space-creator
```

---

## `@lmthing/repl` — Unit Tests

These are fast, deterministic, and require no API keys. They run in every CI pass.

### Sandbox (`src/sandbox/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `sandbox.test.ts` | `Sandbox` class: inject globals, execute TS, scope persistence across statements | `sandbox.getScope()` after each multi-statement execution |
| `executor.test.ts` | `execute()` error capture, timeout enforcement, `GuardError` propagation | — |
| `transpiler.test.ts` | TypeScript → JavaScript transpilation via the TS compiler API; JSX stripping | transpiled output per input snippet |
| `async-manager.test.ts` | Fire-and-forget task registration, cancellation, and result delivery at `stop()` | — |
| `globals.test.ts` | Core globals: `stop`, `display`, `ask`, `sleep`, `tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`, `loadKnowledge` | `sandbox.getScope()` after each global call sequence |
| `globals-advanced.test.ts` | Extended globals: `pipeline`, `parallel`, `guard`, `schema`, `validate`, `broadcast`/`listen`, `pin`/`unpin`, `memo`, `checkpoint`/`rollback`, `speculate`, `delegate`, `cachedFetch`, `trace`, `compress`, `focus`, `watch`, `learn`, `critique`, `reflect`, `fork`, `plan`, `contextBudget`, `knowledge.writer` | `sandbox.getScope()` after each global call sequence |
| `agent-registry.test.ts` | In-sandbox agent registry: register, retrieve, deregister agents | — |

### Session (`src/session/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `session.test.ts` | `Session` lifecycle: idle → executing → complete, `feedToken`, `finalize`, `pause`/`resume` | `session.getMessages()` after `finalize()`; `session.getConversationState()` |
| `config.test.ts` | `createDefaultConfig`, `validateConfig`, `mergeConfig` — config schema validation | — |
| `types.test.ts` | Type guard utilities for `SessionEvent` variants | — |
| `conversation-state.test.ts` | Message builder across turns; `SCOPE` injection, stop payload, error payload | full `ConversationState` after each multi-turn sequence |

### Stream (`src/stream/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `stream-controller.test.ts` | Token accumulation, pause/resume, context injection triggers | — |
| `bracket-tracker.test.ts` | Bracket depth tracking for multi-line statement detection | — |
| `line-accumulator.test.ts` | Complete-statement buffering; four-backtick block detection | accumulated statements per token sequence |
| `serializer.test.ts` | `stop()` payload serialization; object truncation; cycle detection | serialized payload per input value |
| `file-block-applier.test.ts` | File write application: path traversal blocking; diff ledger | written file content after each block |

### Parser (`src/parser/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `ast-utils.test.ts` | AST node extraction: declarations, function signatures, class shapes | extracted declarations per input snippet |
| `statement-detector.test.ts` | `isCompleteStatement()` for every TypeScript statement shape | — |
| `global-detector.test.ts` | `detectGlobalCall()` — recognises `stop(...)`, `display(...)`, etc. | detected call per token sequence |

### Context (`src/context/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `scope-generator.test.ts` | `generateScopeTable()` — variable table from sandbox scope | table string per scope array |
| `code-window.test.ts` | `compressCodeWindow()` — 200-line sliding window, oldest-turn eviction | compressed window per input |
| `stop-decay.test.ts` | Stop payload decay across turns (3-turn TTL) | — |
| `knowledge-decay.test.ts` | Knowledge block decay and eviction logic | — |
| `message-builder.test.ts` | Full message array assembly: system prompt, user/assistant turns, payload injection | full message array per scenario |
| `agents-block.test.ts` | Agent tree → prompt string formatting | formatted block per tree |
| `system-prompt.test.ts` | `buildSystemPrompt()` section assembly; section collapse when focus is active | full prompt string per config (inline snapshots) |

### Hooks (`src/hooks/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `pattern-matcher.test.ts` | `matchPattern()` — glob and regex patterns against code lines | — |
| `hook-executor.test.ts` | All 5 hook actions: `continue`, `side_effect`, `transform`, `interrupt`, `skip` | transformed output per hook action |
| `hook-registry.test.ts` | `HookRegistry` — register, unregister, priority ordering | — |

### Security (`src/security/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `function-registry.test.ts` | `FunctionRegistry` allowlist; `wrapFunction()` proxy; blocked calls throw | — |
| `jsx-sanitizer.test.ts` | `sanitizeJSX()` / `isJSXSafe()` — strips dangerous props, event handlers, `dangerouslySetInnerHTML` | sanitized output per input JSX |

### Catalog (`src/catalog/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `index.test.ts` | `loadCatalog`, `mergeCatalogs`, `formatCatalogForPrompt` | formatted prompt string |
| `fs.test.ts` | `readFile`, `writeFile`, `listDir`, `exists`, `mkdir` — real filesystem via temp dir | — |
| `fetch.test.ts` | `httpGet`, `httpPost` — mocked via `vi.mock('node:http')` | — |
| `shell.test.ts` | `run`, `runCapture` — sandboxed subprocess execution | — |
| `db.test.ts` | `query`, `execute` against an in-memory SQLite database | — |
| `csv.test.ts` | `parseCsv`, `formatCsv` round-trip | — |
| `json.test.ts` | `parseJson`, `formatJson`, schema coercion | — |
| `path.test.ts` | `join`, `resolve`, `dirname`, `basename`, `extname` | — |
| `env.test.ts` | `getEnv`, `requireEnv`, `setEnv` | — |
| `date.test.ts` | `now`, `format`, `parse`, `diff`, timezone handling | — |
| `crypto.test.ts` | `hash`, `hmac`, `uuid`, `randomBytes` | — |
| `image.test.ts` | `resize`, `convert`, `metadata` — mocked `sharp` | — |
| `mcp.test.ts` | MCP tool proxy — mock server/client round-trip | — |
| `types.test.ts` | Catalog type guards and schema helpers | — |

### Knowledge (`src/knowledge/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `writer.test.ts` | `saveKnowledgeFile`, `deleteKnowledgeFile`, `ensureMemoryDomain` — writes/reads real files in temp dir | written file content per call |

---

## `@lmthing/repl` — LLM Integration Tests

These tests make real API calls. They are skipped automatically when API keys are absent. Every test uses `resolveModel("small")` or `resolveModel("large")` so the actual model can be swapped via `.env` without touching test code.

### Global Instruction Quality (`src/sandbox/globals-llm.test.ts`)

**Purpose:** Verify that each global's documentation is clear enough for a real LLM to write correct code on the first try.

**Mechanism:** For each global, the test:
1. Constructs a system prompt from the global's doc string
2. Sends a concrete task prompt to the model
3. **Snapshots `{ systemPrompt, userPrompt, generatedCode }` before execution**
4. Executes the snippet in a real `Sandbox`
5. **Snapshots `sandbox.getScope()` after execution**
6. Asserts the global was called with the expected arguments

Each model size produces its own snapshot entry (prefixed `[small]` / `[large]`) so regressions are visible per model.

Globals covered (one `describe` block each):

| Global | Functional assertion | Scope snapshot captures |
|--------|---------------------|------------------------|
| `stop` | Called with the correct value | `answer` variable |
| `display` | Called once | — |
| `sleep` | Called with a number ≥ 0 | — |
| `pipeline` | Called with data + named transform | `out` variable |
| `parallel` | Called with correct task labels | `results` variable |
| `tasklist` + `completeTask` | Tasklist declared, both tasks completed | — |
| `schema` | Called with the right input object | `s` variable |
| `validate` | Called with value + schema | `result` variable |
| `guard` | Called with a truthy condition | `items` variable |
| `broadcast` + `listen` | Both called with matching channel | `events` variable |
| `pin` + `unpin` | pin/unpin called with matching key | — |
| `memo` | Write then read calls in order | `note` variable |
| `speculate` | Called with correct branch labels | `out` variable |
| `contextBudget` | Budget read; `shouldTrim` derived from recommendation | `budget`, `shouldTrim` |
| `focus` | Called with `"knowledge"` and `"functions"` | — |
| `async` | Called with a function argument | — |

**Running against small and large:**

```bash
cd org/libs/repl
pnpm vitest run src/sandbox/globals-llm.test.ts          # uses .env defaults
pnpm vitest run src/sandbox/globals-llm.test.ts --update-snapshots  # after doc changes
```

### Benchmark Scenarios (`src/benchmark/benchmark.test.ts`)

**Purpose:** Structured pass/fail matrix across all 38 scenarios (25 basic + 13 intermediate) against every model size.

**Snapshots:** Each scenario snapshots the full `{ systemPrompt, userPrompt }` pair it would send, so reviewers can verify the scenario descriptions without running live LLM calls.

Intermediate scenarios test multi-global coordination:

| Scenario group | Globals exercised |
|----------------|-------------------|
| Tasklist flow | `tasklist`, `display`, `completeTask`, `failTask`, `retryTask` |
| Pipeline + guard | `pipeline`, `guard`, `stop` |
| Parallel + speculate | `parallel`, `speculate`, `pin` |
| Context budget | `contextBudget`, `compress`, `memo` |
| Cognitive loop | `fork`, `reflect`, `critique`, `plan` |
| Learning loop | `learn`, `watch` |
| Knowledge writer | `knowledge.writer`, `loadKnowledge` |

---

## `lmthing` (core) — Unit Tests

### CLI (`src/cli/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `bin.test.ts` | CLI entry point: command dispatch, `--help`, `--version` | `--help` output string |
| `args.test.ts` | Argument parsing: `--model`, `--port`, `--debug`, `--catalog` flags | — |
| `loader.test.ts` | Agent file loading: `.ts` / `.md` discovery, dependency resolution | — |
| `server.test.ts` | WebSocket server: connection lifecycle, message routing | — |

### Spawn (`src/spawn.test.ts`)

Tests `executeSpawn()` with a mocked `streamText`. The child `AgentLoop` runs in full (real `Session`, real `Sandbox`) but the LLM stream is replaced with deterministic code strings.

**Snapshots:** After each spawn, the test snapshots:
- The child session's `getMessages()` — shows the full system prompt injected into the child, including the parent's scope table
- The child sandbox's scope via `AgentSpawnResult.scope`

```ts
const result = await executeSpawn(config, spawnContext)
expect(capturedMessages).toMatchSnapshot()   // system prompt sent to child
expect(result.scope).toMatchSnapshot()       // child's final scope
```

Scenarios:
- Child agent receives injected scope from parent
- `stop()` result surfaces back to the parent via `AgentSpawnResult`
- Timeout enforcement
- Error in child propagates to parent

### Agent Namespaces (`src/agent-namespaces.test.ts`)

**Snapshots:** `formatAgentTreeForPrompt()` output snapshotted per fixture space so the exact text injected into the system prompt is reviewed.

- `toNamespaceId` — kebab-case → snake_case conversion
- `readSpaceDependencies` — reads `package.json` `dependencies` field
- `extractParamSchema` — extracts knowledge domain/field schema from agent config
- `buildSpaceAgentTrees` — scans a fixture space directory, returns correct tree shape
- `createNamespaceGlobals` — callable namespace object; each action calls `onSpawn`
- `ChainableSpawnPromise` — `.then()` chain, fluent action API

### Knowledge Namespace (`src/knowledge-namespace.test.ts`)

**Snapshots:** Written file content per `save()` / `addOptions()` call.

- `knowledge.writer({ field })` returns `{ save(), remove(), addOptions() }`
- `save()` calls `saveKnowledgeFile` with correct path/content
- `remove()` calls `deleteKnowledgeFile`
- `addOptions()` writes multiple option files

### RPC (`src/rpc/`)

| File | What it covers | Snapshots |
|------|----------------|-----------|
| `interface.test.ts` | Message type guards and serialization | serialized message per type |
| `client.test.ts` | `RPCClient` request/response cycle (mocked WebSocket) | — |
| `server.test.ts` | `RPCServer` handler registration and dispatch | — |

---

## THING Agent — Integration Tests with Two LLMs

The THING agent (`runThingAgent()`) is the top-level integration target. It boots all 7 built-in spaces, loads the user's spaces directory, and exposes the full global namespace including `space.*`, `fork()`, `speculate()`, and all catalog modules.

Every THING integration test runs twice: once with `model: "small"`, once with `model: "large"`. This catches regressions where richer models compensate for ambiguous instruction text.

**File:** `org/libs/core/src/thing-agent.test.ts`

**Snapshots in every THING test:**

After each test's `finalize()`, snapshot both surfaces unconditionally:

```ts
expect(session.getMessages()).toMatchSnapshot()           // full prompt + all turns
expect(session.getConversationState()).toMatchSnapshot()  // scope deltas, events, stop payloads
```

This makes the `.snap` file the complete replay of what was sent to the LLM and what happened in the sandbox — enough to reproduce a failure without re-running the model.

### Phase 1 — Agent Spawning

```ts
it('[small] spawns a built-in space agent and returns structured result', ...)
it('[large] spawns a built-in space agent and returns structured result', ...)
```

- Starts THING with `runThingAgent({ model })`
- Sends: `"Use the space-chat assistant to reply: hello"`
- Snapshots: parent messages, parent conversation state, child messages (`capturedChildMessages`), child scope
- Asserts `AgentSpawnResult.result` is non-empty
- Timeout: 60 s

### Phase 2 — `speculate()` End-to-End

- Agent calls `speculate([{ label: 'json' }, { label: 'fallback' }])`
- Snapshots: messages, conversation state, `results` variable in scope
- Asserts `results.find(r => r.ok)` is correct

### Phase 3 — `vectorSearch()` End-to-End

- Turn 1: agent stops with a labelled data structure
- Turn 2: agent calls `vectorSearch("label")`
- Snapshots: messages after each turn (captured mid-session)
- Asserts TF-IDF match references turn 1 content

### Phase 5 — Git Commits on File Writes

- `fileWorkingDir` points at a real temp git repo
- Agent writes a file via ` ```` `path` ```` `
- Snapshots: messages, conversation state
- Asserts `git log --oneline` shows new `agent: write` commit

### Phase 6 — Space Creation via File Blocks

- Agent receives: `"Create a space called test-counter with one agent CounterAgent and one knowledge domain counter-config"`
- Snapshots: messages, conversation state, written file contents (read from disk after finalize)
- Asserts directory structure exists and files are valid JSON/YAML

### Phase 7 — `space.create()` + `space.load()`

- Agent calls `space.create(...)` then `space.load(...)` then calls the new agent
- Snapshots: messages, conversation state
- Asserts `greeter` namespace is live; child agent spawn result is non-empty

### Phase 8 — Dynamic Space Loading

- Session starts without `greeter` space; `space.load(fixturePath)` called mid-session
- Snapshots: messages pre-load, messages post-load (shows updated agents section in system prompt)
- Asserts next turn's `greeter.*` calls succeed

### Phase 9 — Full THING Boot

- `runThingAgent({ model, userSpacesDir: tmpDir })`
- Snapshots: initial system prompt (first message in array), `space.list()` result
- Asserts `space.list()` returns 7 entries with correct slugs

### Phase 10 — Web Search Catalog

- Agent calls `webSearch(...)` + `scrapeUrl(...)`
- Snapshots: messages, conversation state, `results` scope variable
- Asserts both return non-empty strings

### Phase 11 — Space Creator Automation

```ts
it('[large] SpaceArchitect creates a cooking space end-to-end', ...)  // large model only
```

- Snapshots: messages, conversation state, written space directory tree (file list)
- Asserts space directory has at least 3 knowledge option files and a callable primary agent

---

## Test Patterns

### Skipping LLM tests when keys are absent

```ts
const hasKeys = !!process.env.AZURE_API_KEY && !!process.env.ZAI_API_KEY
it.skipIf(!hasKeys)('...', async () => { ... })
```

### Running both models with a single helper

```ts
import { resolveModel } from 'lmthing'

const LLM_MODELS = ['small', 'large'] as const

for (const size of LLM_MODELS) {
  it(`[${size}] spawns agent and returns result`, { timeout: 60_000 }, async () => {
    const model = resolveModel(size)
    const { session } = await runThingAgent({ model, userSpacesDir: tmpDir })
    // ... assertions ...
    expect(session.getMessages()).toMatchSnapshot()
    expect(session.getConversationState()).toMatchSnapshot()
  })
}
```

### Complete LLM test template

```ts
it.skipIf(!hasKeys)(`[${size}] stop: can call stop() with a value`, { timeout: 30_000 }, async () => {
  const systemPrompt = makeSystemPrompt(STOP_DOCS)
  const userPrompt = 'Declare answer = 42, then call await stop(answer).'
  const generatedCode = extractCode(await askLlm(size, systemPrompt, userPrompt))

  // Snapshot everything sent to and returned from the model
  expect({ systemPrompt, userPrompt, generatedCode }).toMatchSnapshot()

  // Execute and snapshot resulting sandbox state
  const sb = new Sandbox()
  const stopFn = vi.fn().mockResolvedValue(undefined)
  sb.inject('stop', stopFn)
  await sb.execute(generatedCode)

  expect(sb.getScope()).toMatchSnapshot()

  // Functional assertion
  expect(stopFn).toHaveBeenCalledWith(42)
})
```

### Updating snapshots

```bash
# Update all snapshots in one package
pnpm vitest run --update-snapshots

# Update snapshots for one file only
pnpm vitest run src/sandbox/globals-llm.test.ts --update-snapshots
```

Always commit snapshot updates in their own commit, describing why the output changed (e.g. `chore: update snapshots — stop() doc reworded for clarity`).

### Timeout guidance

| Test type | Recommended timeout |
|-----------|---------------------|
| Unit | default (5 s) |
| Single-turn LLM (small) | 30 s |
| Single-turn LLM (large) | 60 s |
| Multi-turn integration | 120 s |
| Space creator (Phase 11) | 300 s |

# Phase 1d: Agent Registry & {{AGENTS}} Block

## Context

Phase 1d gives the parent agent visibility into spawned agent state — running, resolved, failed, tasklist progress. Only agent calls **saved to a variable** are tracked in the registry. The variable name is the agent's identity. On every `stop()`, the response includes a `{{AGENTS}}` block showing all tracked agent promises.

**Depends on:** Phase 1a (spawn infrastructure — `SpawnConfig`, `SpawnResult`, child sessions) and Phase 1b (agent namespaces — the namespace proxy that calls `register()`). Neither is implemented yet, so this phase defines the interfaces they'll consume.

---

## Implementation Order

### Step 1: Types — `src/session/types.ts`

Add to the file (pure additive, zero risk):

**New types:**

```ts
// ── Agent Registry ──

export type AgentStatus = "running" | "waiting" | "resolved" | "failed";

export interface AgentPromiseEntry {
  varName: string;
  label: string; // e.g. "cooking.general_advisor.mealplan"
  status: AgentStatus;
  promise: Promise<unknown>;
  childSession: import("../session/session").Session | null;
  resolvedValue?: unknown;
  error?: string;
  registeredAt: number;
  completedAt?: number;
  registeredTurn: number;
  pendingQuestion?: { message: string; schema: Record<string, unknown> } | null;
}

export interface AgentSnapshot {
  varName: string;
  label: string;
  status: AgentStatus;
  tasklistsState: TasklistsState | null;
  pendingQuestion: { message: string; schema: Record<string, unknown> } | null;
  error?: string;
  valueIncluded?: boolean; // true if resolved value is in this stop payload
}
```

**Add 3 new variants to `SessionEvent` union** (after line 189):

```ts
| { type: 'agent_registered'; varName: string; label: string }
| { type: 'agent_resolved'; varName: string }
| { type: 'agent_failed'; varName: string; error: string }
```

**Extend `SessionSnapshot`** (add after `tasklistsState` field at line 205):

```ts
agentEntries: Array<{ varName: string; label: string; status: AgentStatus; error?: string }>;
```

### Step 2: Agent Registry — `src/sandbox/agent-registry.ts` (NEW)

New file. Self-contained class following the `HookRegistry` pattern (`src/hooks/hook-registry.ts`).

**Constructor accepts callbacks** (matching `GlobalsConfig` callback pattern):

```ts
interface AgentRegistryConfig {
  onRegistered?: (varName: string, label: string) => void;
  onResolved?: (varName: string) => void;
  onFailed?: (varName: string, error: string) => void;
}
```

**Class: `AgentRegistry`**

```ts
class AgentRegistry {
  private entries = new Map<string, AgentPromiseEntry>()
  private currentTurn = 0
  private config: AgentRegistryConfig

  constructor(config: AgentRegistryConfig = {})

  register(varName: string, promise: Promise<unknown>, label: string, childSession: Session | null): void
  // - Creates entry with status 'running', registeredTurn = currentTurn
  // - Attaches .then() → auto-calls resolve(); .catch() → auto-calls fail()
  // - Calls config.onRegistered

  resolve(varName: string, value: unknown): void
  // - Sets status='resolved', resolvedValue, completedAt
  // - Calls config.onResolved

  fail(varName: string, error: string): void
  // - Sets status='failed', error, completedAt
  // - Calls config.onFailed

  getAll(): AgentPromiseEntry[]
  getPending(): AgentPromiseEntry[]           // running | waiting only
  getSnapshot(varName: string): AgentSnapshot | null
  // - Reads child session tasklist state via childSession?.snapshot().tasklistsState
  getAllSnapshots(): AgentSnapshot[]
  findByPromise(promise: unknown): AgentPromiseEntry | null
  advanceTurn(): void
  getCurrentTurn(): number
  hasEntries(): boolean
  hasVisibleEntries(): boolean                // running/waiting OR completed within 5 turns

  // Phase 1e placeholders (no-op for now)
  setPendingQuestion(varName: string, question: { message: string; schema: Record<string, unknown> }): void
  respond(varName: string, data: Record<string, unknown>): void

  destroy(): void                             // clears all entries
```

**Key implementation details:**

- Auto-resolution via `.then()` / `.catch()` on the promise (like `AsyncManager.register()` at `src/sandbox/async-manager.ts:28-66`)
- `getSnapshot()` reads live child tasklist via `childSession.snapshot().tasklistsState`
- `hasVisibleEntries()`: running/waiting agents always visible; resolved/failed visible for 5 turns after completion

### Step 3: Agents Block Generator — `src/context/agents-block.ts` (NEW)

New file. Follows `generateTasksBlock()` pattern from `src/context/message-builder.ts:68-115`.

```ts
export function generateAgentsBlock(
  registry: AgentRegistry,
  resolvedInThisStop: Set<string>,
): string | null;
```

**Returns** `null` if no entries are visible. Otherwise renders:

```
{{AGENTS}}
┌ varName — label ─────────────────────────────────────────────┐
│ ◉ running                                                    │
│ ┌ tasks ───────────────────────────────────────────────────┐  │
│ │ ✓ task_id          → { key: "value" }                   │  │
│ │ ◉ running_task     (running — message... 60%)            │  │
│ │ ○ blocked_task     (blocked — waiting on: dep)           │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Rendering per status:**

- `◉ running` — with nested tasklist if child has one, otherwise "(no tasklist)"
- `? waiting — needs input from parent` — with question block (Phase 1e)
- `✓ (value included in this stop payload)` — if in `resolvedInThisStop` set
- `✓ resolved` — if resolved but value not in this payload
- `✗ {error}` — failed agent

**Decay for resolved/failed entries:**

- 0-2 turns after completion: full detail
- 3-5 turns: compact (just `✓ resolved` or `✗ failed`, no child tasks)
- 6+ turns: removed from block

**Nested task rendering** reuses the same symbol/detail logic from `generateTasksBlock()`. Extract a shared helper:

```ts
// In message-builder.ts, extract:
export function renderTaskSymbolAndDetail(
  task: TaskDefinition,
  state: TasklistState,
): { symbol: string; detail: string };
```

Both `generateTasksBlock` and `agents-block.ts` call this helper.

### Step 4: Wire into Session — `src/session/session.ts`

**New imports:**

```ts
import { AgentRegistry } from "../sandbox/agent-registry";
import { generateAgentsBlock } from "../context/agents-block";
```

**New field** (after line 52 `private tasklistReminderCount`):

```ts
private agentRegistry: AgentRegistry
```

**Constructor** (after `this.hookRegistry` init at line 63):

```ts
this.agentRegistry = new AgentRegistry({
  onRegistered: (varName, label) => {
    this.emitEvent({ type: "agent_registered", varName, label });
  },
  onResolved: (varName) => {
    this.emitEvent({ type: "agent_resolved", varName });
  },
  onFailed: (varName, error) => {
    this.emitEvent({ type: "agent_failed", varName, error });
  },
});
```

**New public getter:**

```ts
getAgentRegistry(): AgentRegistry {
  return this.agentRegistry
}
```

**Modify `handleStop`** (lines 196-216):

```ts
private handleStop(payload: StopPayload, source: string): void {
  this.stopCount++
  this.agentRegistry.advanceTurn()                          // NEW

  const cpState = this.globalsApi.getTasklistsState()
  const tasksBlock = generateTasksBlock(cpState)

  // NEW: determine which agents resolved in this stop
  const resolvedInThisStop = new Set<string>()
  for (const [, sv] of Object.entries(payload)) {
    const entry = this.agentRegistry.findByPromise(sv.value)
    if (entry?.status === 'resolved') resolvedInThisStop.add(entry.varName)
  }
  const agentsBlock = generateAgentsBlock(this.agentRegistry, resolvedInThisStop)

  const baseMsg = buildStopMessage(payload)
  let msg = baseMsg
  if (tasksBlock) msg += `\n\n${tasksBlock}`
  if (agentsBlock) msg += `\n\n${agentsBlock}`               // NEW

  // ...rest unchanged from line 202 onwards
}
```

**Modify `snapshot`** (add after `tasklistsState` at line 417):

```ts
agentEntries: this.agentRegistry.getAll().map(e => ({
  varName: e.varName,
  label: e.label,
  status: e.status,
  error: e.error,
})),
```

**Modify `destroy`** (line 485, before `this.sandbox.destroy()`):

```ts
this.agentRegistry.destroy();
```

### Step 5: Wire into Agent Loop — `src/cli/agent-loop.ts`

**New import:**

```ts
import { generateAgentsBlock } from "../context/agents-block";
```

**Add event cases to the turn loop listener** (after `class_loaded` at line 403):

```ts
case 'agent_registered':
  console.log(`\x1b[36m  [agent]\x1b[0m registered: ${event.varName} — ${event.label}`)
  break
case 'agent_resolved':
  console.log(`\x1b[32m  [agent]\x1b[0m resolved: ${event.varName}`)
  break
case 'agent_failed':
  console.log(`\x1b[31m  [agent]\x1b[0m failed: ${event.varName} — ${event.error}`)
  break
```

**Same event cases in `runSetupCode` listener** (after `class_loaded` at line 253).

**Modify stop handling** (lines 546-580) to append `{{AGENTS}}`:

```ts
if (state.stop) {
  const entries = Object.entries(state.stop)
    .map(([k, v]) => `${k}: ${v.display}`)
    .join(", ");
  let stopMsg = `← stop { ${entries} }`;

  // NEW: append {{AGENTS}} block
  const registry = this.session.getAgentRegistry();
  if (registry.hasVisibleEntries()) {
    const resolvedInThisStop = new Set<string>();
    for (const [, sv] of Object.entries(state.stop)) {
      const entry = registry.findByPromise(sv.value);
      if (entry?.status === "resolved") resolvedInThisStop.add(entry.varName);
    }
    const agentsBlock = generateAgentsBlock(registry, resolvedInThisStop);
    if (agentsBlock) stopMsg += `\n\n${agentsBlock}`;
  }

  // ...rest unchanged
}
```

**Add agent summary to end-of-turn output** (after tasklist summary at line 635):

```ts
const agentEntries = this.session.snapshot().agentEntries;
if (agentEntries.length > 0) {
  console.log(`\n\x1b[36m━━━ Agents ━━━\x1b[0m`);
  for (const e of agentEntries) {
    const symbol =
      e.status === "resolved"
        ? "✓"
        : e.status === "failed"
          ? "✗"
          : e.status === "waiting"
            ? "?"
            : "◉";
    const color = e.status === "resolved" ? "32" : e.status === "failed" ? "31" : "36";
    console.log(
      `  \x1b[${color}m${symbol}\x1b[0m ${e.varName}: ${e.label} — ${e.status}${e.error ? ` — ${e.error}` : ""}`,
    );
  }
}
```

### Step 6: Conversation State — `src/session/conversation-state.ts`

**Add to `TurnEvent` union** (after line 48):

```ts
| { type: 'agent_registered'; varName: string; label: string }
| { type: 'agent_resolved'; varName: string }
| { type: 'agent_failed'; varName: string; error: string }
```

**Add to `toTurnEvent` switch** (before `default:` at line 412):

```ts
case 'agent_registered':
  return { type: 'agent_registered', varName: event.varName, label: event.label }
case 'agent_resolved':
  return { type: 'agent_resolved', varName: event.varName }
case 'agent_failed':
  return { type: 'agent_failed', varName: event.varName, error: event.error }
```

### Step 7: Public Exports — `src/index.ts`

Add after line 53 (sandbox exports):

```ts
export { AgentRegistry } from "./sandbox/agent-registry";
export type { AgentRegistryConfig } from "./sandbox/agent-registry";
```

Add after line 76 (context exports):

```ts
export { generateAgentsBlock } from "./context/agents-block";
```

The `AgentPromiseEntry`, `AgentSnapshot`, `AgentStatus` types are already exported from `types.ts` via the existing re-export at line 6-42.

### Step 8: Extract shared task renderer — `src/context/message-builder.ts`

Extract the task symbol/detail logic (lines 77-106) into a reusable function so `agents-block.ts` can use it for nested child tasklists:

```ts
export function renderTaskLine(
  task: TaskDefinition,
  state: TasklistState,
): { symbol: string; detail: string };
```

Update `generateTasksBlock` to call this extracted function instead of inline logic.

---

## Critical Files

| File                                | Action                               | Lines Changed        |
| ----------------------------------- | ------------------------------------ | -------------------- |
| `src/session/types.ts`              | Modify — add types + events          | ~25 lines added      |
| `src/sandbox/agent-registry.ts`     | **New** — core registry class        | ~150 lines           |
| `src/context/agents-block.ts`       | **New** — {{AGENTS}} block generator | ~120 lines           |
| `src/context/message-builder.ts`    | Modify — extract `renderTaskLine`    | ~10 lines refactored |
| `src/session/session.ts`            | Modify — wire registry               | ~25 lines added      |
| `src/cli/agent-loop.ts`             | Modify — append block, log events    | ~30 lines added      |
| `src/session/conversation-state.ts` | Modify — add event types             | ~10 lines added      |
| `src/index.ts`                      | Modify — add exports                 | ~3 lines added       |

**Key reuse points:**

- `src/context/message-builder.ts:68-115` — `generateTasksBlock` pattern for block generation
- `src/hooks/hook-registry.ts` — `HookRegistry` class pattern for the registry
- `src/sandbox/async-manager.ts:28-66` — Promise auto-resolution pattern
- `src/session/session.ts:122-168` — Callback → event emission wiring pattern

---

## Test Plan

### `src/sandbox/agent-registry.test.ts`

- **register**: creates entry with status 'running', correct turn
- **auto-resolution**: resolves when promise fulfills, fails when rejects
- **callbacks**: onRegistered/onResolved/onFailed called correctly
- **getAll/getPending**: filters by status correctly
- **getSnapshot**: returns null for unknown varName; reads child session tasklist
- **findByPromise**: finds by reference, returns null for unknown
- **advanceTurn**: increments counter
- **hasVisibleEntries**: true for running, true for recently resolved, false when decayed
- **destroy**: clears all entries

### `src/context/agents-block.test.ts`

- Returns null for empty registry
- Renders running agent without tasklist
- Renders running agent with nested tasks (using correct symbols)
- Renders resolved agent (value included vs not)
- Renders failed agent with error
- Multiple agents in separate boxes
- Decay: compact after 3 turns, removed after 6
- Waiting agent with question (Phase 1e placeholder)

### `src/context/message-builder.test.ts`

- Verify `renderTaskLine` extraction didn't break `generateTasksBlock`

### Run all tests

```bash
cd /home/vasilis/GEANT/lmthing/org/libs/repl && npx vitest run
```

---

## Design Notes

1. **AgentRegistry is session-level, not a sandbox global.** Phase 1b's namespace proxy calls `session.getAgentRegistry().register()` when a namespace call is saved to a variable. The agent never calls it directly.

2. **Variable name detection is Phase 1b's job.** The registry accepts `varName` as a parameter. Phase 1b inspects `currentSource` (via `extractVariableNames` from `src/parser/ast-utils.ts`) to determine tracked vs fire-and-forget.

3. **Child session reference for live tasklist.** The registry stores a `Session` reference. `getSnapshot()` calls `childSession.snapshot().tasklistsState` for live child tasklist state. Stale after child destruction, but entry is resolved/failed by then.

4. **{{AGENTS}} goes in both session.messages AND AgentLoop.messages.** The session's `handleStop` builds the internal record. The AgentLoop's stop handling builds what the LLM sees. Both need the block.

5. **Phase 1e placeholders.** `setPendingQuestion` and `respond` are defined but throw "not implemented" for now. The `waiting` status and `?` symbol are rendereable but won't be triggered until Phase 1e.

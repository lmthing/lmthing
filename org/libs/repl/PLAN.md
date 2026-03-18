# Plan: Make @lmthing/repl Capable of What Claude Code Does

## Analysis

### What Claude Code Is

Claude Code is an **agentic harness** — it wraps an LLM with:

1. **Agentic loop**: gather context → take action → verify results → repeat
2. **Structured tools**: Read, Edit, Write, Glob, Grep, Bash, WebFetch, WebSearch, Agent (subagents)
3. **Permission system**: 3 modes (default ask-for-everything, auto-accept edits, plan mode) + per-command allowlists in settings
4. **Checkpoints**: file snapshots before every edit, rewindable via Esc×2
5. **Context management**: CLAUDE.md loading, auto-memory across sessions, compaction, `/compact`, `/context`
6. **Session persistence**: resume (`--continue`), fork (`--fork-session`), directory-scoped sessions
7. **Subagents**: spawn independent agents with fresh context windows for parallelism
8. **Git awareness**: branch detection, uncommitted changes, recent history
9. **Plan mode**: read-only tools, create plan, user approves, then execute
10. **Interruption**: user can type mid-stream to steer the agent

### What @lmthing/repl Currently Is

A **streaming TypeScript REPL agent** where the LLM writes executable code with 7 globals (`stop`, `display`, `ask`, `async`, `tasklist`, `completeTask`, `loadKnowledge`). The host parses, executes, and renders in real time.

**Existing strengths:**
- Session state machine with events
- AgentLoop with turn management, debug logging
- Sandbox with persistent scope, TS transpilation
- Stream controller with pause/resume
- Hooks system (AST pattern matching, 5 actions)
- Context management (scope table, code window, stop decay, knowledge decay)
- Function catalog (fs, fetch, shell, crypto, env, db, etc.)
- React render surface (display/ask)
- WebSocket RPC layer + web UI
- Knowledge system

### The Gap

| Claude Code Capability | REPL Status | Gap |
|---|---|---|
| Structured tool calls (Read/Edit/Write/Glob/Grep/Bash) | Has catalog functions but not structured tools with schemas | **Large** — need tool definitions with Zod schemas |
| Permission system (3 modes + allowlists) | None | **Large** — need permission layer |
| Checkpoints (file snapshots, rewind) | None | **Medium** — need checkpoint system |
| CLAUDE.md / project context loading | Has knowledge system for spaces | **Medium** — need project-level instruction loading |
| Auto-memory (cross-session learnings) | None | **Medium** — need memory persistence |
| Session persistence (resume/fork) | Has in-memory session only | **Medium** — need serialization + storage |
| Subagents (parallel independent agents) | None | **Medium** — need agent spawning |
| Git awareness | None | **Small** — read git state |
| Plan mode (read-only → approve → execute) | None | **Medium** — need mode system |
| Context compaction | Has code window + stop decay | **Small** — extend to full message compaction |
| Web search/fetch | Has catalog/fetch | **Small** — add web search |
| Interruption | Has user intervention | **Already exists** |
| Slash commands/skills | None | **Small** — add command system |

### Design Philosophy

The REPL's unique value is that **the LLM writes executable code, not prose**. Claude Code uses structured JSON tool calls. Rather than replacing the code-first approach, we should **enhance it** so the REPL can do everything Claude Code does while keeping its code-native identity.

The approach: the LLM still writes TypeScript, but now has access to **tool-like globals** that mirror Claude Code's capabilities — `read()`, `edit()`, `write()`, `glob()`, `grep()`, `bash()`, `webSearch()`, `webFetch()` — alongside the existing `stop()`, `display()`, `ask()`, etc. These are backed by the same catalog system but elevated to first-class status with permission checks.

---

## Implementation Plan

### Phase 1: Core Tool Globals (File + Search + Execution)

Add Claude Code's primary tool categories as sandbox globals. These build on the existing catalog system.

#### 1.1 — File Operation Globals

**Files:**
- `src/catalog/read.ts` — Read file contents (returns string, supports line range)
- `src/catalog/edit.ts` — Find-and-replace edit (old_string → new_string, with uniqueness check)
- `src/catalog/write.ts` — Create/overwrite file (requires read-first for existing files)

**Behavior:**
```typescript
// In agent code:
const content = read("/path/to/file.ts")
edit("/path/to/file.ts", { old: "foo", new: "bar" })
write("/path/to/new-file.ts", "content here")
```

Each function checks permissions before executing (see Phase 2).

#### 1.2 — Search Globals

**Files:**
- `src/catalog/glob.ts` — Find files by pattern (returns sorted paths)
- `src/catalog/grep.ts` — Search file contents with regex (returns matches with context)

**Behavior:**
```typescript
const files = glob("src/**/*.ts")
const matches = grep("TODO", { path: "src/", type: "ts" })
```

#### 1.3 — Enhanced Shell Global

**File:** Update `src/catalog/shell.ts`

Enhance the existing shell function to match Claude Code's Bash tool:
- Working directory persistence between calls
- Timeout support (default 120s, max 600s)
- Background execution mode
- Output capture (stdout + stderr)

```typescript
const result = bash("npm test", { timeout: 300000 })
const bg = bash("npm run build", { background: true })
```

#### 1.4 — Web Globals

**Files:**
- `src/catalog/web-search.ts` — Web search via configurable provider (returns results with URLs)
- Update `src/catalog/fetch.ts` — Enhance to match WebFetch (HTML→markdown conversion, prompt-based extraction)

```typescript
const results = webSearch("react 19 new features")
const content = webFetch("https://docs.example.com", "extract the API reference")
```

#### 1.5 — Agent System Prompt Updates

**File:** Update `src/cli/buildSystemPrompt.ts`

Add tool documentation to the system prompt so the LLM knows how to use the new globals. Structure as a tools reference section similar to Claude Code's tool descriptions.

---

### Phase 2: Permission System

#### 2.1 — Permission Engine

**Files:**
- `src/permissions/types.ts` — Permission types (PermissionMode, PermissionRule, PermissionCheck)
- `src/permissions/engine.ts` — Core permission checking logic
- `src/permissions/settings.ts` — Load/save settings from `.repl/settings.json`

**Three modes** (matching Claude Code):
1. **Default** — ask before file edits and shell commands; reads are auto-allowed
2. **Auto-accept edits** — file operations auto-allowed, shell commands still ask
3. **Plan mode** — read-only tools only (read, glob, grep, webFetch, webSearch); writes/edits/bash blocked

**Per-command allowlists** in `.repl/settings.json`:
```json
{
  "permissions": {
    "allow": ["bash:npm test", "bash:git status", "bash:pnpm *"],
    "mode": "default"
  }
}
```

#### 2.2 — Permission Gate in Globals

**File:** `src/permissions/gate.ts`

Wrap each tool global with permission checks. When a tool requires permission:
1. Pause the stream (existing `streamController.pause()`)
2. Emit a `permission_request` event to the UI
3. Wait for user approval/denial via `ask()`-like mechanism
4. Resume or skip based on response

#### 2.3 — Permission UI

**Files:**
- `src/web/components/PermissionDialog.tsx` — Modal for permission requests
- Update `src/web/App.tsx` — Handle permission events

---

### Phase 3: Checkpoints & Undo

#### 3.1 — Checkpoint System

**Files:**
- `src/checkpoints/store.ts` — Checkpoint storage (file snapshots + metadata)
- `src/checkpoints/manager.ts` — Create/restore checkpoints, track affected files

**Behavior:**
- Before any `edit()` or `write()` call, snapshot the file's current contents
- Store snapshots in memory (session-scoped) with timestamp and tool call ID
- Support `rewind(n)` to restore files to state before the nth-most-recent edit
- Emit `checkpoint_created` and `checkpoint_restored` events

#### 3.2 — Rewind Integration

**File:** Update `src/session/session.ts`

Add `rewind()` method to session. When triggered:
1. Restore affected files from checkpoint
2. Truncate conversation history to the checkpoint point
3. Emit `rewind` event to UI
4. Resume from earlier state

---

### Phase 4: Project Context & Memory

#### 4.1 — Project Context Loading (CLAUDE.md equivalent)

**Files:**
- `src/context/project-context.ts` — Find and load CLAUDE.md / REPL.md / .repl/instructions.md
- Update `src/cli/buildSystemPrompt.ts` — Inject project context into system prompt

**Behavior:**
- On session start, walk up from cwd looking for `REPL.md`, `CLAUDE.md`, or `.repl/instructions.md`
- Also check `~/.repl/instructions.md` for user-global instructions
- Load and inject into system prompt (before user message, after tool docs)
- Support hierarchical loading (project > workspace > user-global)

#### 4.2 — Auto-Memory

**Files:**
- `src/memory/store.ts` — Persistent memory storage (`.repl/memory.json`)
- `src/memory/manager.ts` — Save/load learnings, deduplication, relevance scoring

**Behavior:**
- LLM can call `remember(key, value)` to save learnings
- On session start, load first 200 lines of memory into system prompt
- Memory scoped per project directory
- Auto-save patterns the agent discovers (e.g., "this project uses vitest")

#### 4.3 — Git Context

**Files:**
- `src/context/git.ts` — Read git state (branch, uncommitted changes, recent log)

**Behavior:**
- On session start, capture current branch, status, and last 10 commits
- Inject as context in system prompt
- Auto-refresh after `bash("git ...")` commands

---

### Phase 5: Session Persistence

#### 5.1 — Session Serialization

**Files:**
- `src/session/serializer.ts` — Serialize/deserialize session state to JSON
- `src/session/store.ts` — Session file storage (`.repl/sessions/`)

**State to persist:**
- Conversation messages
- Sandbox scope (variable names + serializable values)
- Tasklist state
- Checkpoint history
- Memory entries created during session
- Config/settings at time of session

#### 5.2 — Resume & Fork

**File:** Update `src/cli/args.ts` and `src/cli/bin.ts`

Add CLI flags:
- `--continue` — resume most recent session in current directory
- `--resume` — pick from recent sessions
- `--fork-session` — fork from a resumed session (new ID, shared history)

#### 5.3 — Session Compaction

**Files:**
- `src/context/compactor.ts` — Summarize old messages when context fills

**Behavior:**
- Track approximate token count of messages
- When approaching limit (configurable, default 100K tokens), summarize older messages
- Preserve: system prompt, recent N messages, user messages, key code snippets
- Compress: old tool outputs, verbose command results, intermediate reasoning

---

### Phase 6: Subagents

#### 6.1 — Subagent Spawning

**Files:**
- `src/agents/spawner.ts` — Create child sessions with fresh context
- `src/agents/types.ts` — Subagent config, result types

**Behavior:**
```typescript
// In agent code:
const result = await agent("Search for all uses of deprecated API", {
  tools: ["read", "glob", "grep"],  // subset of tools
  maxTurns: 5,
})
```

- Each subagent gets its own Session + AgentLoop with independent context
- Inherits project context and permissions from parent
- Returns summary when done
- Can run in parallel (multiple agents at once)

#### 6.2 — Agent Coordination

**File:** `src/agents/coordinator.ts`

Manage concurrent subagents:
- Track running agents
- Collect results
- Cancel on parent session destroy
- Emit events for UI tracking

---

### Phase 7: Plan Mode

#### 7.1 — Mode System

**Files:**
- `src/modes/types.ts` — Mode definitions (default, auto-accept, plan)
- `src/modes/manager.ts` — Mode switching, tool filtering per mode

**Plan mode behavior:**
1. Restrict to read-only tools: `read`, `glob`, `grep`, `webSearch`, `webFetch`
2. LLM creates a plan (stored as structured data via `tasklist()`)
3. User reviews plan in UI
4. On approval, switch to default/auto-accept mode and execute
5. Each plan step maps to a tasklist task for progress tracking

#### 7.2 — Mode UI

**Files:**
- Update `src/web/components/InputBar.tsx` — Mode indicator + toggle (Shift+Tab equivalent)
- `src/web/components/PlanView.tsx` — Plan review/approval UI

---

### Phase 8: Slash Commands & Skills

#### 8.1 — Command Registry

**Files:**
- `src/commands/registry.ts` — Register and dispatch slash commands
- `src/commands/built-in.ts` — Built-in commands

**Built-in commands:**
- `/context` — Show context window usage
- `/compact [focus]` — Force compaction with optional focus
- `/mode [default|auto|plan]` — Switch permission mode
- `/memory` — Show/edit auto-memory
- `/rewind [n]` — Undo last n edits
- `/sessions` — List recent sessions
- `/help` — Command reference

#### 8.2 — Command UI

**File:** Update `src/web/components/InputBar.tsx`

- Detect `/` prefix in input
- Show autocomplete dropdown for available commands
- Execute commands without sending to LLM

---

### Phase 9: Integration & Polish

#### 9.1 — Wire Everything Together

**File:** Update `src/cli/bin.ts`

- Load project context on startup
- Load auto-memory on startup
- Load git context on startup
- Initialize permission engine with settings
- Initialize checkpoint manager
- Register all new globals with session
- Set up slash command registry

#### 9.2 — Update System Prompt

**File:** Update `src/cli/buildSystemPrompt.ts`

Create a comprehensive system prompt that teaches the LLM:
- All available tools and their usage patterns
- Permission awareness (don't retry denied tools)
- Agentic loop pattern (gather context → act → verify)
- When to use subagents vs doing work directly
- Plan mode conventions
- Memory and context management

#### 9.3 — Update RPC Interface

**File:** Update `src/rpc/interface.ts`

Add RPC methods for:
- Permission responses (approve/deny)
- Mode switching
- Checkpoint operations
- Session management (resume/fork)
- Slash command execution

#### 9.4 — Update Web UI

**Files:** Various `src/web/components/*.tsx`

- Permission dialog
- Mode indicator
- Checkpoint/rewind controls
- Session picker (resume/fork)
- Context usage display
- Plan review view

---

## Implementation Order (Dependency Graph)

```
Phase 1 (Tools)
  ├── 1.1 File globals (read/edit/write)
  ├── 1.2 Search globals (glob/grep)
  ├── 1.3 Enhanced shell
  ├── 1.4 Web globals
  └── 1.5 System prompt updates
        │
Phase 2 (Permissions) ← depends on Phase 1
  ├── 2.1 Permission engine
  ├── 2.2 Permission gate
  └── 2.3 Permission UI
        │
Phase 3 (Checkpoints) ← depends on 1.1 (file ops)
  ├── 3.1 Checkpoint store
  └── 3.2 Rewind integration
        │
Phase 4 (Context) ← independent
  ├── 4.1 Project context loading
  ├── 4.2 Auto-memory
  └── 4.3 Git context
        │
Phase 5 (Sessions) ← depends on Phase 1-4
  ├── 5.1 Serialization
  ├── 5.2 Resume/fork
  └── 5.3 Compaction
        │
Phase 6 (Subagents) ← depends on Phase 1-2
  ├── 6.1 Spawner
  └── 6.2 Coordinator
        │
Phase 7 (Plan Mode) ← depends on Phase 2
  ├── 7.1 Mode system
  └── 7.2 Plan UI
        │
Phase 8 (Commands) ← depends on Phase 1-7
  ├── 8.1 Command registry
  └── 8.2 Command UI
        │
Phase 9 (Integration) ← depends on all phases
  ├── 9.1 Wire together
  ├── 9.2 System prompt
  ├── 9.3 RPC interface
  └── 9.4 Web UI
```

**Phases 1, 3, 4 can proceed in parallel.** Phase 2 needs Phase 1. Phases 5-7 can proceed once their dependencies are met. Phase 8-9 are final integration.

---

## File Summary

### New Files (~30 files)

```
src/
├── catalog/
│   ├── read.ts          # 1.1
│   ├── edit.ts          # 1.1
│   ├── write.ts         # 1.1
│   ├── glob.ts          # 1.2
│   ├── grep.ts          # 1.2
│   └── web-search.ts    # 1.4
├── permissions/
│   ├── types.ts         # 2.1
│   ├── engine.ts        # 2.1
│   ├── settings.ts      # 2.1
│   └── gate.ts          # 2.2
├── checkpoints/
│   ├── store.ts         # 3.1
│   └── manager.ts       # 3.1
├── context/
│   ├── project-context.ts  # 4.1
│   ├── git.ts              # 4.3
│   └── compactor.ts        # 5.3
├── memory/
│   ├── store.ts         # 4.2
│   └── manager.ts       # 4.2
├── session/
│   ├── serializer.ts    # 5.1
│   └── store.ts         # 5.1
├── agents/
│   ├── spawner.ts       # 6.1
│   ├── types.ts         # 6.1
│   └── coordinator.ts   # 6.2
├── modes/
│   ├── types.ts         # 7.1
│   └── manager.ts       # 7.1
├── commands/
│   ├── registry.ts      # 8.1
│   └── built-in.ts      # 8.1
└── web/components/
    ├── PermissionDialog.tsx  # 2.3
    └── PlanView.tsx          # 7.2
```

### Modified Files (~10 files)

```
src/catalog/shell.ts        # 1.3 — enhanced bash
src/catalog/fetch.ts        # 1.4 — enhanced web fetch
src/cli/buildSystemPrompt.ts # 1.5, 9.2 — system prompt
src/cli/bin.ts              # 5.2, 9.1 — CLI flags, startup
src/cli/args.ts             # 5.2 — new CLI args
src/session/session.ts      # 3.2, 9.1 — rewind, new globals
src/rpc/interface.ts        # 9.3 — new RPC methods
src/web/App.tsx             # 9.4 — permission, mode, sessions
src/web/components/InputBar.tsx  # 7.2, 8.2 — mode toggle, commands
src/web/components/ChatView.tsx  # 9.4 — new block types
```

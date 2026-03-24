---
title: State Management
description: Virtual file system, React context hierarchy, hooks, and workspace sync patterns
order: 2
---

# State Management Patterns

State in lmthing is managed through a Virtual File System (VFS) that acts as the single source of truth for all workspace data.

## Virtual File System Architecture

The VFS is an in-memory `Map<string, string>` that stores workspace files as path → content pairs. It provides:

- **FSEventBus** — fine-grained subscriptions at file, directory, glob, and prefix levels
- **React hooks** — `useFile()`, `useDir()`, `useGlob()`, `useDraft()` for reactive data binding
- **GitHub sync** — push/pull to a private GitHub repo for persistence

### Event Subscription Levels

```typescript
// File-level: triggers when a specific file changes
eventBus.on('file:agents/my-agent/instruct.md', callback)

// Directory-level: triggers when any file in a directory changes
eventBus.on('dir:agents/', callback)

// Glob-level: triggers when any matching file changes
eventBus.on('glob:**/config.json', callback)

// Prefix-level: triggers when any file with a prefix changes
eventBus.on('prefix:knowledge/', callback)
```

## React Context Hierarchy

Three nested providers scope the VFS to progressively smaller subsets:

```
AppProvider (root VFS — entire workspace)
  └── StudioProvider (studio scope — current studio view)
        └── SpaceProvider (space scope — current space files)
```

Each provider creates a scoped view of the VFS. Components inside `SpaceProvider` see only the current space's files, with paths relative to the space root.

## Hook Patterns

### `useFile(path)` — Read/Write a Single File

```typescript
const [content, setContent] = useFile('agents/my-agent/instruct.md')
// content: string | null (null if file doesn't exist)
// setContent: (newContent: string) => void
```

### `useDir(path)` — List Directory Contents

```typescript
const entries = useDir('agents/')
// entries: string[] — file names in the directory
```

### `useGlob(pattern)` — Pattern Matching

```typescript
const configs = useGlob('**/config.json')
// configs: Map<string, string> — path → content for all matches
```

### `useDraft(path)` — Optimistic Editing

```typescript
const { value, setValue, save, discard, isDirty } = useDraft('agents/my-agent/instruct.md')
// setValue: updates local draft without writing to VFS
// save: commits draft to VFS
// discard: reverts to VFS state
// isDirty: true if draft differs from VFS
```

## Data Flow

1. **User edits** → `useDraft` → local draft state
2. **User saves** → `save()` → VFS `Map.set()` → `FSEventBus.emit()` → all subscribers re-render
3. **Sync** → VFS → GitHub push (on explicit save/sync)
4. **Load** → GitHub pull → VFS → all subscribers re-render

## No Server State

There is no server-side state for workspace data. The VFS is ephemeral (in-memory) and persisted exclusively through GitHub sync. This means:

- Refreshing the browser loses unsaved changes
- Multiple tabs share no state (each has its own VFS instance)
- Conflict resolution follows git merge semantics on sync

## Agent State

Agent runtime state is stored in `values.json` within the agent directory. This file:

- Starts empty (`{}`)
- Populated at runtime with knowledge field selections and user inputs
- Read by the agent framework to inject context into prompts
- Not synced until explicitly saved

## Pattern: Scoped File Operations

When inside a `SpaceProvider`, all file operations are scoped to the space:

```typescript
// Inside SpaceProvider for "cooking" space
const [content] = useFile('agents/general-advisor/instruct.md')
// Actually reads: cooking/agents/general-advisor/instruct.md from the VFS
```

This scoping is transparent — components don't need to know the full path.

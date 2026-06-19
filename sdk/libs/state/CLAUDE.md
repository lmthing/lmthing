# @lmthing/state - AI Assistant Guide

This package implements the LMThing File System Architecture - a layered, scoped virtual file system with fine-grained event subscriptions. It's the core state management layer for LMThing applications.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development build (watch mode)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Project Structure

```
src/
├── types/              # Core TypeScript types
│   └── studio.ts       # FileTree, SpaceConfig, StudioConfig, AppData
├── lib/
│   ├── fs/             # Core file system implementation
│   │   ├── AppFS.ts           # Root FS with Map<string, string> storage
│   │   ├── ScopedFS.ts        # UserFS, StudioFS, SpaceFS scoped proxies
│   │   ├── FSEventBus.ts      # Trie-based event bus with prefix dispatch
│   │   ├── DraftStore.ts      # In-memory draft/change tracking
│   │   ├── glob.ts            # Glob pattern matching (**, ?, *, extglob)
│   │   ├── paths.ts           # Path utilities (P.globs.*, P.instruct, etc.)
│   │   ├── crypto/            # AES-GCM encryption for .env files
│   │   └── parsers/           # YAML frontmatter, JSON, config parsing
│   └── contexts/       # React context providers
│       ├── AppContext.tsx     # App-level: AppFS, DraftStore, current selection
│       ├── StudioContext.tsx  # Studio-level: StudioFS, current space
│       └── SpaceContext.tsx   # Space-level: SpaceFS
└── hooks/             # React hooks for consuming FS state
    ├── fs/             # Low-level FS hooks
    │   ├── useAppFS.ts        # Access AppFS from context
    │   ├── useStudioFS.ts     # Access StudioFS
    │   ├── useSpaceFS.ts      # Access SpaceFS
    │   ├── useFile.ts         # Read single file by path
    │   ├── useDir.ts          # Read directory listing
    │   └── useGlob.ts         # Glob pattern matching
    ├── studio/         # Studio-level hooks
    │   ├── useApp.ts          # App context convenience hook
    │   ├── useStudio.ts       # Studio context
    │   ├── useStudioConfig.ts # Studio config (lmthing.json)
    │   └── useStudioEnv.ts    # Environment file handling
    ├── agent/          # Agent-specific hooks
    │   ├── useAgentInstruct.ts    # Agent instruct.md (frontmatter + body)
    │   ├── useAgentConfig.ts      # runtimeFields from instruct.md frontmatter
    │   ├── useAgentValues.ts      # formValues from instruct.md frontmatter
    │   └── useAgentConversation.ts # Agent conversations
    ├── tasklist/       # Tasklist hooks (replaces the old flow/ hooks)
    │   ├── useTasklistTask.ts      # Read a single tasklists/<name>/NN-<id>.md
    │   └── useTasklistTaskList.ts  # List tasks in a tasklist
    ├── knowledge/      # Knowledge domain hooks
    │   ├── useKnowledgeFieldIndex.ts # knowledge/<domain>/<field>/index.md
    │   ├── useKnowledgeFile.ts
    │   └── useKnowledgeDir.ts
    ├── workspace/      # Workspace-level hooks
    │   ├── usePackageJson.ts   # package.json parsing
    │   └── useEnvFile.ts       # .env file parsing
    └── useDraft.ts      # Draft/change tracking hooks
```

## Architecture Overview

### File System Hierarchy

All file data lives in a single `Map<string, string>` within `AppFS`. Paths follow this structure:

```
{username}/
  {studioId}/
    lmthing.json           # Studio config
    .env                   # Shared environment
    {spaceId}/
      package.json
      agents/{agentId}/
        instruct.md                 # frontmatter (title, knowledge[], functions[],
                                     #   components[], actions[], runtimeFields, formValues) + body
        conversations/{convId}.json
      tasklists/{tasklistName}/
        {NN}-{taskId}.md            # zero-padded ordered task files
      knowledge/{domain}/
        index.md                    # domain descriptor (label, icon, color, renderAs)
        {field}/
          index.md                  # field descriptor (type, variable, default, …)
          {optionSlug}.md           # selectable options
```

> **Migration note:** the old shape (`agents/*/config.json`, `agents/*/values.json`,
> `flows/`, `knowledge/<domain>/config.json`) has been removed. Per-agent runtime
> selections live in `instruct.md` frontmatter (`runtimeFields`/`formValues`);
> flows are now `tasklists/`; knowledge domains/fields are described by `index.md`.

### Scoped FS Classes

- **AppFS**: Root file system. Owns the `Map<string, string>` storage and `FSEventBus`.
- **UserFS**: Scoped to `{username}/` prefix
- **StudioFS**: Scoped to `{username}/{studioId}/` prefix
- **SpaceFS**: Scoped to `{username}/{studioId}/{spaceId}/` prefix

All scoped classes implement `FSInterface` and transparently proxy to the underlying `AppFS`.

### Event System

The `FSEventBus` provides fine-grained subscriptions:

```ts
import { useFile } from '@/hooks/fs/useFile'

// Automatically subscribes to changes to this specific file
const content = useFile('agents/bot/instruct.md')
```

Available subscription types:
- `onFile(path)` - specific file changes
- `onFileCreate(path)` - file creation only
- `onFileUpdate(path)` - file updates only
- `onFileDelete(path)` - file deletion only
- `onDir(dir)` - directory entry changes (add/remove/rename)
- `onPrefix(prefix)` - all events under a path prefix
- `onGlob(pattern)` - all events matching a glob pattern

## Import Conventions

This project uses path aliases configured in `tsconfig.json`:

```ts
// Use @/ for all imports from src root
import { AppFS } from '@/lib/fs/AppFS'
import { useFile } from '@/hooks/fs/useFile'
import type { FileTree } from '@/types/studio'

// Relative imports only for same-directory files
import { siblingFn } from './sibling'
```

## Key Patterns

### Reading Files

```ts
// Low-level: read any file
import { useFile } from '@/hooks/fs/useFile'
const content = useFile('agents/bot/instruct.md')

// High-level: typed parsers
import { useAgentInstruct } from '@/hooks/agent/useAgentInstruct'
const instruct = useAgentInstruct('bot') // Returns AgentInstruct | null
```

### Writing Files

```ts
// Get the appropriate FS instance
import { useSpaceFS } from '@/hooks/fs/useSpaceFS'

function MyComponent() {
  const spaceFS = useSpaceFS()

  const writeFile = () => {
    spaceFS.writeFile('new-file.md', '# Content')
  }
}
```

### Glob Patterns

```ts
import { useGlob } from '@/hooks/fs/useGlob'

// All markdown files in current space
const markdownFiles = useGlob('**/*.md')

// All agents
const agents = useGlob('agents/*/instruct.md')

// All tasks across tasklists (extglob supported)
const tasks = useGlob('tasklists/@(flow1|flow2)/[0-9][0-9]-*.md')
```

### Path Utilities

The `P` object from `@/lib/fs/paths` provides typed path builders:

```ts
import { P } from '@/lib/fs/paths'

// Agent paths (instruct.md carries title/knowledge/functions/components/
// actions/runtimeFields/formValues in frontmatter — there is no config.json/values.json)
P.instruct('bot')              // → 'agents/bot/instruct.md'
P.conversations('bot')         // → 'agents/bot/conversations'

// Tasklist paths (replaces the old flows/)
P.tasklistDir('my-flow')              // → 'tasklists/my-flow'
P.tasklistTask('my-flow', 1, 'step1') // → 'tasklists/my-flow/01-step1.md'
P.globs.tasklistTasks('my-flow')      // → 'tasklists/my-flow/[0-9][0-9]-*.md'

// Knowledge paths (domains + fields are described by index.md)
P.knowledgeDomainIndex('domain')          // → 'knowledge/domain/index.md'
P.knowledgeFieldIndex('domain', 'field')  // → 'knowledge/domain/field/index.md'
P.knowledgeOption('domain', 'field', 'opt') // → 'knowledge/domain/field/opt.md'
P.globs.allKnowledgeDomainIndexes         // → 'knowledge/*/index.md'
```

## Context Hierarchy

React contexts are nested - providers must be arranged in order:

```tsx
<AppProvider>        // Provides AppFS, DraftStore, studio/space selection
  <StudioProvider>   // Provides StudioFS, current space ID
    <SpaceProvider>  // Provides SpaceFS
      <YourComponent />
    </SpaceProvider>
  </StudioProvider>
</AppProvider>
```

### Using Contexts

```tsx
import { useApp } from '@/hooks/studio/useApp'
import { useStudio } from '@/hooks/studio/useStudio'
import { useSpaceContext } from '@/lib/contexts/SpaceContext'

function MyComponent() {
  const { appFS, drafts, currentStudioKey, currentSpaceId } = useApp()
  const { studioFS, currentSpaceId: studioSpaceId } = useStudio()
  const { spaceFS } = useSpaceContext()
}
```

## Draft System

The draft system tracks unsaved changes in memory:

```ts
import { useDraft, useDraftMutations, useUnsavedPaths } from '@/hooks/useDraft'

function MyEditor({ path }: { path: string }) {
  const draft = useDraft(path)           // Get draft content
  const hasUnsaved = useHasDraft(path)    // Check if has draft
  const { set, delete: deleteDraft } = useDraftMutations()

  const handleChange = (content: string) => {
    set(path, content)  // Save to draft store
  }

  const handleSave = () => {
    // Write to actual FS and clear draft
    spaceFS.writeFile(path, draft)
    deleteDraft(path)
  }
}
```

## Parser Types

### Frontmatter (YAML)

```ts
import { parseFrontmatter, serializeFrontmatter } from '@/lib/fs/parsers/frontmatter'

const result = parseFrontmatter(`
---
name: My Flow
description: A test flow
tags: [test, example]
---
Content here
`)
// result.frontmatter.name === 'My Flow'
// result.content === 'Content here'
```

### Agent Instruct

`agents/<slug>/instruct.md` — frontmatter + body. There is no separate
config.json/values.json; runtime selections live in the frontmatter.

```ts
interface AgentInstruct {
  title: string
  knowledge: string[]
  functions: string[]
  components: string[]
  actions: { id: string; label: string; description: string; tasklist: string }[]
  defaultAction?: string
  dependencies: string[]
  runtimeFields?: Record<string, string[]>          // component → field refs
  formValues?: Record<string, Record<string, unknown>> // component → saved values
  body: string                                       // system-prompt markdown
}
```

### Tasklist Task

`tasklists/<name>/NN-<id>.md` — replaces the old flow task.

```ts
interface TasklistTask {
  order: number              // 1-based, from the NN- prefix
  id: string                 // the part after NN-
  instruction: string        // body
  output: Record<string, string>
  dependsOn?: string[]
  optional?: boolean
  goal?: boolean             // exactly one task per tasklist is the goal
}
```

### Conversation

```ts
interface Conversation {
  metadata: {
    id: string
    agentId: string
    createdAt: string
    updatedAt: string
    messageCount: number
  }
  messages: Message[]
}
```

## Testing

Tests are co-located with source files using the `.test.ts` or `.test.tsx` suffix.

```tsx
// src/hooks/fs/useFile.test.tsx
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { AppProvider, StudioProvider, SpaceProvider } from '@/lib/contexts'
import { AppFS } from '@/lib/fs/AppFS'
import { useFile } from './useFile'

function createWrapper(appFS: AppFS) {
  return ({ children }) => (
    <AppProvider>
      <StudioProvider>
        <SpaceProvider>
          {children}
        </SpaceProvider>
      </StudioProvider>
    </AppProvider>
  )
}

describe('useFile', () => {
  it('should read file content', () => {
    const appFS = new AppFS()
    appFS.writeFile('test.txt', 'content')
    const { result } = renderHook(() => useFile('test.txt'), {
      wrapper: createWrapper(appFS)
    })
    expect(result.current).toBe('content')
  })
})
```

## Common Tasks

### Add a new hook

1. Create hook file in appropriate `src/hooks/` subdirectory
2. Import from `@/` for all non-relative imports
3. Use `useSyncExternalStore` for FS subscriptions
4. Add co-located `.test.tsx` file

### Add a new parser

1. Create parser in `src/lib/fs/parsers/`
2. Export `parseXXX` and `serializeXXX` functions
3. Add corresponding types to `src/types/` if needed
4. Add tests in `.test.ts` file

### Extend event subscriptions

The `FSEventBus` already supports fine-grained subscriptions. For new subscription patterns, add methods to `FSEventBus` class and ensure they properly handle prefix stripping for scoped FS classes.

## Important Notes

1. **All file paths in AppFS are absolute** (include username/studio/space prefixes)
2. **Scoped FS classes strip their prefix** - SpaceFS sees relative paths
3. **Never mutate the FileTree directly** - use AppFS methods
4. **Always use context providers** - hooks depend on them
5. **Drafts are in-memory only** - they don't persist across sessions
6. **Glob patterns use custom implementation** - not minimatch/glob
7. **Tests use jsdom environment** - React hooks need DOM

## Build & Development

- Source files are in `src/`
- Compiled output goes to `dist/`
- Build uses `tsc` (TypeScript compiler)
- Tests use `vitest` with jsdom
- Path alias `@/*` maps to `src/*`

## Troubleshooting

**"Cannot find module '@/lib/xxx'"**
- Ensure `tsconfig.json` has correct paths configuration
- Check that file exists in `src/` directory

**Tests fail with "useApp must be used within AppProvider"**
- Wrap test components in `<AppProvider><StudioProvider><SpaceProvider>`
- Use the `createWrapper` pattern shown in testing section

**Glob patterns not matching**
- This package uses a custom glob implementation
- Extglob patterns like `@(a|b)`, `*(a|b)`, `+(a|b)`, `?(a|b)` are supported
- Character classes `[a-z]` and ranges work as expected

**Draft not persisting**
- Drafts are intentionally in-memory only
- Use `useDraftMutations().save()` to write to actual FS

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
    │   ├── useAgentInstruct.ts    # Agent instruct.md
    │   ├── useAgentConfig.ts      # Agent config.json
    │   ├── useAgentValues.ts      # Agent values.json
    │   └── useAgentConversation.ts # Agent conversations
    ├── flow/           # Flow-specific hooks
    │   ├── useFlowIndex.ts     # Flow index.md
    │   ├── useFlowTask.ts      # Individual flow task
    │   └── useFlowTaskList.ts  # List flow tasks
    ├── knowledge/      # Knowledge domain hooks
    │   ├── useKnowledgeConfig.ts
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
        instruct.md
        config.json
        values.json
        conversations/{convId}.json
      flows/{flowId}/
        index.md
        {order}.{name}.md
      knowledge/{domain}/
        config.json
        {file}.md
```

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

// All agent configs
const agentConfigs = useGlob('agents/*/config.json')

// All flow tasks (extglob supported)
const flowTasks = useGlob('flows/@(flow1|flow2)/*.md')
```

### Path Utilities

The `P` object from `@/lib/fs/paths` provides typed path builders:

```ts
import { P } from '@/lib/fs/paths'

// Agent paths
P.instruct('bot')              // → 'agents/bot/instruct.md'
P.agentConfig('bot')           // → 'agents/bot/config.json'
P.agentValues('bot')           // → 'agents/bot/values.json'
P.conversations('bot')         // → 'agents/bot/conversations'

// Flow paths
P.flowIndex('my-flow')         // → 'flows/my-flow/index.md'
P.flowTask('my-flow', 'step1') // → 'flows/my-flow/01.step1.md'
P.globs.flowTasks('my-flow')   // → 'flows/my-flow/*.md'

// Knowledge paths
P.knowledgeConfig('domain')    // → 'knowledge/domain/config.json'
P.knowledgeFile('domain', 'file') // → 'knowledge/domain/file.md'
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

```ts
interface AgentInstruct {
  name: string
  description?: string
  instructions: string
  tools?: string[]
  model?: string
}
```

### Flow Task

```ts
interface FlowTask {
  name: string
  description?: string
  agent?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  content?: string
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

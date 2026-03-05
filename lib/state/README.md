# @lmthing/state

A layered, scoped file system with a fine-grained event bus for React applications. All state lives in a flat `Map<string, string>` with transparent prefix-scoped proxies for multi-level hierarchies.

## Features

- **Single Source of Truth** - All files stored in one `Map<string, string>`
- **Fine-Grained Event Bus** - Components subscribe only to what they read (no spurious re-renders)
- **Trie-Based Prefix Dispatch** - O(depth) lookup for prefix subscriptions
- **Four-Level Hierarchy** - App → User → Studio → Space scoping
- **TypeScript** - Full type safety throughout
- **React Hooks** - `useSyncExternalStore` based hooks for optimal performance
- **Persistence** - LocalStorage integration with automatic saving
- **Advanced Glob Patterns** - Support for extglobs, character classes, brace expansion

## Installation

```bash
npm install @lmthing/state
```

## Quick Start

```tsx
import { AppProvider, StudioProvider, SpaceProvider, useFile } from '@lmthing/state'

function App() {
  return (
    <AppProvider>
      <StudioProvider>
        <SpaceProvider>
          <YourApp />
        </SpaceProvider>
      </StudioProvider>
    </AppProvider>
  )
}

function FileViewer() {
  const content = useFile('agents/bot/instruct.md')
  return <pre>{content || 'Loading...'}</pre>
}
```

## File System Hierarchy

```
{username}/
  {studioId}/
    lmthing.json           # Studio config
    .env                   # Shared environment
    .env.local
    {spaceId}/
      package.json         # Space package
      agents/              # AI agents
        {agentId}/
          instruct.md      # Agent instructions
          config.json      # Agent configuration
          values.json      # Runtime values
          conversations/   # Chat history
            {convId}.json
      flows/               # Workflow definitions
        {flowId}/
          index.md
          {order}.{name}.md
      knowledge/           # Knowledge base
        {domain}/
          config.json
          {file}.md
```

## Core Concepts

### FS Classes

```ts
import { AppFS, StudioFS, SpaceFS } from '@lmthing/state'

// AppFS - owns the data and event bus
const appFS = new AppFS(initialData)

// StudioFS - scoped to {username}/{studioId}
const studioFS = new StudioFS(appFS, 'alice', 'my-studio')

// SpaceFS - scoped to {username}/{studioId}/{spaceId}
const spaceFS = new SpaceFS(appFS, 'alice', 'my-studio', 'main-space')
```

### Event Bus Subscriptions

```ts
import { useSpaceFS } from '@lmthing/state'

function MyComponent() {
  const fs = useSpaceFS()

  // Subscribe to specific file
  fs.onFile('config.json', (event) => {
    console.log('config changed!', event)
  })

  // Subscribe to directory changes
  fs.onDir('agents', (event) => {
    if (event.type === 'add') {
      console.log('New agent:', event.entry)
    }
  })

  // Subscribe to all changes under prefix
  fs.onPrefix('agents', (event) => {
    console.log('Agent-related change:', event.path)
  })

  // Subscribe by glob pattern
  fs.onGlob('**/*.md', (event) => {
    console.log('Markdown file changed:', event.path)
  })

  return null
}
```

## React Hooks

### Foundation Hooks

```ts
import {
  useFile,           // Read single file
  useFileFrontmatter, // Parse frontmatter
  useFileConfig,      // Parse JSON config
  useDir,             // List directory
  useGlob,            // Glob pattern match
  useGlobRead         // Read all matching files
} from '@lmthing/state'

// Read a file
const content = useFile('agents/bot/instruct.md')

// Parse frontmatter + content
const { frontmatter, content } = useFileFrontmatter('docs/page.md')

// List directory entries
const files = useDir('agents')

// Find all markdown files
const mdFiles = useGlob('**/*.md')
```

### Domain-Specific Hooks

```ts
import {
  // Agent hooks
  useAgent,
  useAgentInstruct,
  useAgentConfig,
  useAgentConversations,
  useAgentList,

  // Flow hooks
  useWorkFlow,
  useFlowIndex,
  useFlowTaskList,

  // Knowledge hooks
  useKnowledge,
  useKnowledgeConfig,

  // Studio/App hooks
  useApp,
  useStudio,
  useStudioConfig,
} from '@lmthing/state'

// Get complete agent data
const { instruct, config, values } = useAgent('bot-id')

// List all agents
const agents = useAgentList()

// Get workflow
const { index, tasks } = useWorkFlow('workflow-id')
```

## Writing Files

```ts
import { useSpaceFS } from '@lmthing/state'

function Editor() {
  const fs = useSpaceFS()

  const save = (content: string) => {
    fs.writeFile('agents/bot/instruct.md', content)
  }

  const saveMultiple = () => {
    fs.batch([
      { type: 'write', path: 'a.txt', content: 'a' },
      { type: 'write', path: 'b.txt', content: 'b' },
      { type: 'delete', path: 'old.txt' }
    ])
  }

  return <textarea onSave={save} />
}
```

## Draft / Unsaved Changes

```ts
import { useDraft, useDraftMutations, useHasDraft } from '@lmthing/state'

function DraftEditor() {
  const content = useFileWithDraft('file.txt')
  const hasDraft = useHasDraft('file.txt')
  const { set, save, delete: deleteDraft } = useDraftMutations()

  const handleChange = (value: string) => {
    set('file.txt', value) // Save to draft store
  }

  const handleSave = () => {
    save('file.txt') // Write to actual FS and clear draft
  }

  return (
    <div>
      <textarea value={content} onChange={e => handleChange(e.target.value)} />
      {hasDraft && <span>Unsaved changes</span>}
      <button onClick={handleSave}>Save</button>
    </div>
  )
}
```

## Path Utilities

```ts
import { P } from '@lmthing/state'

// App-level paths
P.user('alice')
P.studio('alice', 'my-studio')
P.studioSpace('alice', 'my-studio', 'main')

// Studio-level paths (relative to StudioFS)
P.studioConfig         // 'lmthing.json'
P.studioEnv('prod')    // '.env.prod'
P.space('main')        // 'main'

// Space-level paths (relative to SpaceFS)
P.packageJson          // 'package.json'
P.instruct('bot')      // 'agents/bot/instruct.md'
P.conversation('bot', 'chat-1') // 'agents/bot/conversations/chat-1.json'
P.flowTask('flow', 1, 'task')    // 'flows/flow/1.task.md'

// Glob patterns
P.globs.allAgents      // 'agents/*/instruct.md'
P.globs.allFlows       // 'flows/*/index.md'
P.globs.knowledgeDomains // 'knowledge/*/config.json'
```

## Encryption

```ts
import {
  parseEnvFile,
  serializeEnvFile,
  encryptEnvFile,
  decryptEnvFile,
  isEncrypted
} from '@lmthing/state'

// Parse .env file
const env = parseEnvFile('KEY=value\nDEBUG=true')

// Serialize to .env format
const content = serializeEnvFile({ KEY: 'value', DEBUG: 'true' })

// Encrypt with password (uses AES-GCM)
const encrypted = await encryptEnvFile(content, 'my-password')

// Decrypt
const decrypted = await decryptEnvFile(encrypted, 'my-password')

// Check if encrypted
if (isEncrypted(content)) {
  console.log('This file is encrypted')
}
```

## API Reference

See [API.md](./docs/API.md) for complete API documentation.

## Examples

- [Basic File Operations](./examples/basic-file-ops.tsx)
- [Agent Management](./examples/agent-management.tsx)
- [Workflow Editor](./examples/workflow-editor.tsx)
- [Knowledge Base](./examples/knowledge-base.tsx)

## License

MIT

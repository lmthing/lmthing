# taskGraphPlugin — DAG-Based Task Management

## Overview

The built-in task graph plugin provides `defTaskGraph` for dependency-aware task management using a Directed Acyclic Graph (DAG). Unlike `defTaskList`, it supports task dependencies, automatic unblocking, and context propagation. It is **auto-loaded**.

**Source:** `src/plugins/taskGraph/`

## Usage

```typescript
import { runPrompt } from 'lmthing';

const { result } = await runPrompt(async ({ defTaskGraph, $ }) => {
  const [graph, setGraph] = defTaskGraph([
    { id: 'research', title: 'Research', description: 'Research the topic',
      status: 'pending', dependencies: [], unblocks: ['write'],
      required_capabilities: ['web-search'] },
    { id: 'write', title: 'Write', description: 'Write the report',
      status: 'pending', dependencies: ['research'], unblocks: ['review'],
      required_capabilities: ['writing'] },
    { id: 'review', title: 'Review', description: 'Review the final report',
      status: 'pending', dependencies: ['write'], unblocks: [],
      required_capabilities: ['review'] },
  ]);

  $`Execute the task graph. Use getUnblockedTasks to find ready tasks and updateTaskStatus to track progress.`;
}, {
  model: 'openai:gpt-4o'
});
```

## TaskNode Interface

```typescript
interface TaskNode {
  id: string;                     // Unique identifier
  title: string;                  // Concise task name
  description: string;            // Detailed execution instructions
  status: TaskNodeStatus;         // 'pending' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[];         // IDs of upstream tasks that must complete first
  unblocks: string[];             // IDs of downstream tasks waiting on this one
  required_capabilities: string[];// e.g., ["database", "web-search"]
  assigned_subagent?: string;     // Subagent handling this task
  input_context?: string;         // Context from upstream tasks (auto-propagated)
  output_result?: string;         // Summary/artifact produced upon completion
}
```

## Auto-Registered Tools

- **`generateTaskGraph(tasks)`** — Create or replace the task DAG with cycle detection and validation.
- **`getUnblockedTasks()`** — Get tasks whose dependencies are fully completed.
- **`updateTaskStatus(taskId, status, output_result?)`** — Update status; automatically unblocks downstream tasks on completion.

## Key Features

- **Dependency Enforcement**: Tasks cannot start until all upstream dependencies complete
- **Automatic Unblocking**: Completing a task unblocks downstream tasks with all deps met
- **Context Propagation**: `output_result` from completed tasks is passed as `input_context` to downstream tasks
- **Cycle Detection**: Graph validated for circular dependencies using Kahn's algorithm
- **Graph Normalization**: Dependencies/unblocks relationships kept symmetric automatically

## System Prompt

```
## Task Graph Status

### In Progress (1)
  - [research] Research [web-search]

### Ready to Start (0)
  (none)

### Blocked / Pending (1)
  - [write] Write (depends on: research) [writing]

### Completed (0)
  (none)

Use "getUnblockedTasks" to find tasks ready for execution, "updateTaskStatus" to update task progress.
```

## Exported Utilities

- `detectCycles(tasks)` — Detects circular dependencies using Kahn's algorithm
- `validateTaskGraph(tasks)` — Validates graph consistency (duplicate IDs, missing refs, cycles)
- `normalizeTaskGraph(tasks)` — Ensures symmetric dependency/unblocks relationships
- `getUnblockedTasks(tasks)` — Returns tasks with all dependencies completed

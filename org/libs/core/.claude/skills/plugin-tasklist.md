# taskListPlugin — Simple Task Management

## Overview

The built-in task list plugin provides `defTaskList` for managing flat task lists. It is **auto-loaded** — no imports or configuration needed.

**Source:** `src/plugins/taskList/`

## Usage

```typescript
import { runPrompt } from 'lmthing';

const { result } = await runPrompt(async ({ defTaskList, $ }) => {
  const [tasks, setTasks] = defTaskList([
    { id: '1', name: 'Research the topic', status: 'pending' },
    { id: '2', name: 'Write implementation', status: 'pending' },
    { id: '3', name: 'Test the implementation', status: 'pending' },
  ]);

  $`Complete the tasks. Use startTask when beginning work,
    completeTask when done, and failTask if there's an error.`;
}, {
  model: 'openai:gpt-4o'
  // No plugins array needed — auto-loaded!
});
```

## Task Interface

```typescript
interface Task {
  id: string;         // Unique identifier
  name: string;       // Task description
  status: TaskStatus; // 'pending' | 'in_progress' | 'completed' | 'failed'
  metadata?: Record<string, any>;  // Optional metadata
}
```

## Auto-Registered Tools

- **`startTask(taskId)`** — Mark a task as in-progress. Can restart failed tasks.
- **`completeTask(taskId)`** — Mark a task as completed.
- **`failTask(taskId, reason?)`** — Mark a task as failed with optional reason.

## System Prompt

The plugin automatically updates the system prompt with current task status via `defEffect`:

```
## Current Task Status

### In Progress (1)
  - [1] Research the topic

### Pending (2)
  - [2] Write implementation
  - [3] Test the implementation

### Completed (0)
  (none)

Use "startTask" to begin a pending task and "completeTask" when finished.
```

## Implementation Details

- Provides `defTaskList(tasks)` method
- Creates `startTask`, `completeTask`, and `failTask` tools automatically
- Updates system prompt with task status via `defEffect`
- Returns `[taskList, setTaskList]` tuple for state access

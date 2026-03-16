## Background Tasks — Async Sidebar

When the agent calls `async(...)`, a card appears in the **Async Tasks sidebar**. Each card shows:

```
┌─────────────────────────┐
│  async_0                │
│  Generating report...   │  ← derived from the code's comment or function name
│  ⏳ 14s elapsed          │
│  ━━━━━━━━━━━╺━━━ 70%   │  ← if progress is estimable, otherwise just a spinner
│                         │
│  [Cancel]               │
└─────────────────────────┘
```

### Task label

The sidebar card needs a human-readable label. Derived from:
1. A `//` comment immediately before the `async()` call (preferred — the agent should be instructed to comment before async).
2. The first function name inside the async body (e.g., `generateReport` → "Generating report").
3. Fallback: the task ID (`async_0`).

### Task states

| State | Appearance |
|-------|------------|
| **Running** | Spinner or progress bar, elapsed time ticking, Cancel button visible |
| **Completed** | Green checkmark, final elapsed time, result summary (truncated), card fades after 5s |
| **Cancelled** | Orange "Cancelled" badge, card fades after 5s |
| **Failed** | Red "Error" badge, error message, card persists |

### Cancelling a task

When the user clicks **Cancel**, a text input appears on the card:

```
┌─────────────────────────┐
│  async_0                │
│  Generating report...   │
│                         │
│  Cancel message:        │
│  ┌───────────────────┐  │
│  │ Not needed anymore│  │
│  └───────────────────┘  │
│  [Confirm cancel]       │
└─────────────────────────┘
```

The user can optionally type a message explaining why they're cancelling. When confirmed:

1. The host terminates the async task.
2. Instead of the task's resolved value, the cancellation message is delivered to the agent in the next `stop` call:

```
← stop { ..., async_0: { cancelled: true, message: "Not needed anymore" } }
```

The agent sees this in the stop payload and can react accordingly.

If the user clicks Cancel without typing a message, the default cancellation payload is:

```
{ cancelled: true, message: "" }
```

### Sidebar behavior

- When no async tasks are running, the sidebar collapses to a small icon/badge in the top-right area of the interface.
- When tasks exist, the sidebar opens automatically. It can be manually collapsed.
- Completed/cancelled task cards fade out after 5 seconds to keep the sidebar clean. Failed task cards persist until the session ends.
- On mobile, the sidebar is a bottom sheet that slides up when tasks are active.

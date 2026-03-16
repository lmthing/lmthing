# User Experience — Chat Interface Specification

This document describes the user-facing interface for the streaming TypeScript REPL agent. It covers what the user sees, how they interact, and how the system communicates execution state. It is written for the design and frontend engineering team.

Read the **system prompt** and **runtime contract** companion documents first. This document assumes familiarity with the protocol primitives (`stop`, `ask`, `display`, `async`, errors).

---

## Design Philosophy

The user is talking to an agent that **does things** in real time. The interface should feel like watching a process unfold — components appear, the agent reads values, errors happen and get fixed, background tasks churn — and the user can see all of it, intervene at any point, or just watch.

Three principles:

1. **Transparent process, progressive disclosure.** Nothing is hidden — code execution, stop reads, errors, async tasks are all visible. But they are **collapsed by default** so the primary view is clean. The user expands what they're curious about.
2. **The user is always in control.** The message input is always enabled. The user can pause the agent, inject a message, cancel background tasks, or override the agent's direction at any moment. The agent is a collaborator, not an autonomous black box.
3. **The agent is responsive, not chatty.** UI appears as soon as the agent renders it. Progress is shown through the work itself — rendered components, collapsible process blocks, and the async sidebar — not through "Let me think about that..." text fillers.

---

## Interface Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                        ┌──────────────────┐ │
│  ┌──────────────────────────────────────────────────┐  │  Async Tasks     │ │
│  │                 Message Area                      │  │                  │ │
│  │                                                   │  │  ┌────────────┐ │ │
│  │  ┌─── user bubble ────────────────────────────┐   │  │  │ async_0    │ │ │
│  │  │ Find me Italian restaurants nearby          │   │  │  │ Generating │ │ │
│  │  └────────────────────────────────────────────┘   │  │  │ report...  │ │ │
│  │                                                   │  │  │ ⏳ 12s     │ │ │
│  │  ┌─── agent response ─────────────────────────┐   │  │  │ [Cancel]   │ │ │
│  │  │                                             │   │  │  └────────────┘ │ │
│  │  │  ▸ Code ─────────────────────── 3 lines     │   │  │                  │ │
│  │  │                                             │   │  │  ┌────────────┐ │ │
│  │  │  ┌── rendered component ─────────────────┐  │   │  │  │ async_1    │ │ │
│  │  │  │  🍝 Restaurant List (8 results)       │  │   │  │  │ Fetching   │ │ │
│  │  │  │  ...                                  │  │   │  │  │ reviews... │ │ │
│  │  │  └───────────────────────────────────────┘  │   │  │  │ ⏳ 4s      │ │ │
│  │  │                                             │   │  │  │ [Cancel]   │ │ │
│  │  │  ▸ Read ─── { "restaurants.length": 8 }     │   │  │  └────────────┘ │ │
│  │  │                                             │   │  │                  │ │
│  │  │  ┌── form card ─────────────────────────┐   │   │  └──────────────────┘ │
│  │  │  │  Which one?                          │   │   │                        │
│  │  │  │  [Flour + Water        ▾]            │   │   │                        │
│  │  │  │                         [Submit]     │   │   │                        │
│  │  │  └──────────────────────────────────────┘   │   │                        │
│  │  │                                             │   │                        │
│  │  └─────────────────────────────────────────────┘   │                        │
│  │                                                   │                        │
│  └───────────────────────────────────────────────────┘                        │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────┐           │
│  │  [Message input — always enabled]             [Pause] [Send]   │           │
│  └────────────────────────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────────────────┘
```

The layout has three regions:

1. **Message area** (main column) — scrollable chat history. User messages on the right, agent response blocks on the left. Agent blocks contain a mix of collapsible process blocks, rendered components, and forms.
2. **Async sidebar** (right rail) — shows all running background tasks with status, elapsed time, and cancel controls. Collapses to a small badge when no tasks are active.
3. **Input bar** (bottom, persistent) — always enabled. Has a Send button and a Pause button. The user can type and send a message at any time, even mid-execution.

---

## The Agent Response Block

A single agent turn produces one response block. This block is a vertical sequence of **elements** that appear in the order the agent produces them. There are five element types:

### 1. Code block (collapsible) — `▸ Code`

Every stretch of agent code between interactions produces a collapsible code block. This is **collapsed by default**, showing a single summary line.

**Collapsed view:**
```
▸ Code ─────────────────────────────────── 5 lines
```

**Expanded view:**
```
▾ Code ─────────────────────────────────── 5 lines
┌─────────────────────────────────────────────────┐
│  const input = await ask(                       │
│    <form>                                       │
│      <TextInput name="zipcode" label="Zip" />   │
│    </form>                                      │
│  )                                              │
└─────────────────────────────────────────────────┘
```

**Summarized view (old code, context window compressed):**

In long sessions, older code blocks are replaced by the host with a summary to manage context window size. The UI shows these as non-expandable dimmed blocks:

```
▸ Code ─── lines 1-12 · declared: input, restaurants ── (summarized)
```

The user can see *what* was declared but not the original source. The tag "(summarized)" and dimmed styling distinguishes these from expandable blocks. The summary is not expandable — the full source is no longer in the agent's context.

The code is **syntax-highlighted** TypeScript. It updates in real time as the agent streams — if the user has it expanded, they see code appearing line by line.

The line count in the collapsed summary updates as code streams. Comments (`//`) are included in the code block and visible when expanded.

If the agent writes code between two visible events (e.g., between a `display` and an `ask`), each stretch is its own collapsible code block, keeping the flow readable.

### 2. Read block (collapsible) — `▸ Read`

When the agent calls `stop(...)` and the host injects a `← stop` user message, a collapsible **read block** appears in the flow showing what the agent inspected.

**Collapsed view:**
```
▸ Read ─── { "restaurants.length": 8 }
```

The collapsed view shows the payload summary on a single line. For small payloads this is sufficient — the user can see the key information without expanding.

**Expanded view (for larger payloads):**
```
▾ Read ─── restaurants.length + 2 more
┌─────────────────────────────────────────────────┐
│  {                                              │
│    "restaurants.length": 8,                     │
│    "restaurants[0].name": "Flour + Water",      │
│    "restaurants[0].rating": 4.7                 │
│  }                                              │
└─────────────────────────────────────────────────┘
```

**Decayed views (older reads, context window compressed):**

The host progressively truncates older stop payloads in the agent's context. The UI reflects this:

- **Keys only (3–5 turns back):**
  ```
  ▸ Read ─── input: Object{zipcode,radius} ── (keys only)
  ```
- **Count only (6–10 turns back):**
  ```
  ▸ Read ─── 2 values read ── (summarized)
  ```
- **Removed (11+ turns back):** The read block disappears entirely from the UI.

Decayed read blocks are dimmed and show a "(keys only)" or "(summarized)" tag. They are still visible in the scroll history so the user can see the flow, but the payloads are no longer available to the agent. The user is shown the decay state so they understand what the agent can and cannot see.

Read blocks use a distinct visual style — a muted accent color (e.g., blue-gray left border) to distinguish them from code and error blocks.

### 3. Error block (collapsible) — `▸ Error`

When a runtime or type error occurs, an error block appears in the flow.

**Collapsed view:**
```
▸ Error ─── TypeError: Cannot read property 'name' of undefined
```

The collapsed view shows the error type and message. The red/orange left border makes it visually distinct.

**Expanded view:**
```
▾ Error ─── TypeError: Cannot read property 'name' of undefined
┌─────────────────────────────────────────────────┐
│  TypeError: Cannot read property 'name'         │
│  of undefined                                   │
│                                                 │
│  at line 14:                                    │
│  > const name = user.name                       │
│                                                 │
│  Recovery: agent continued ✓                    │
└─────────────────────────────────────────────────┘
```

If the agent successfully recovers (writes corrective code that executes), the error block shows a "Recovery: agent continued ✓" status. If the agent fails repeatedly, the status shows "Recovery: failed ✗" with the number of attempts.

### 4. Hook block (collapsible) — `▸ Hook`

When a developer hook fires on the agent's code, a hook block appears in the flow. This gives the user visibility into the guardrails and automations the developer has configured.

**Collapsed view — side-effect/observe hooks (no interruption):**
```
▸ Hook ─── cost-tracker · tracked API call to fetchPatientData
```

These are informational — the agent was not interrupted. Styled with a subtle purple/gray left border.

**Collapsed view — interrupt hooks:**
```
▸ Hook ─── delete-guard · interrupted: "Confirm with user before deleting"
```

Interrupt hooks have a more prominent amber left border since they altered the agent's execution.

**Expanded view:**
```
▾ Hook ─── delete-guard · interrupted
┌─────────────────────────────────────────────────┐
│  Pattern: CallExpression → deleteRecord()       │
│  Matched line 23:                               │
│  > const result = await deleteRecord(id)        │
│                                                 │
│  Action: interrupt                              │
│  Message: "⚠ You're about to call              │
│  deleteRecord(). Please confirm with the        │
│  user via ask() before deleting data."          │
│                                                 │
│  Agent response: adjusted ✓                     │
└─────────────────────────────────────────────────┘
```

**Collapsed view — transform hooks:**
```
▸ Hook ─── auto-transaction · transformed: wrapped DB call in transaction
```

**Collapsed view — skip hooks:**
```
▸ Hook ─── dedup-fetches · skipped: results already in scope
```

Skip hooks show an amber warning icon since the agent's code was silently dropped.

Hook blocks appear at the exact point in the flow where the hook fired — between the code block that triggered it and the next element. For `before` phase hooks that interrupt or skip, the hook block replaces what would have been the execution of that line.

### 5. Rendered component — `display()`

Full-width rendered React components appear directly in the flow (not collapsible). These are the primary output the user cares about.

Components fade in with a 150ms ease-out transition. They stack vertically in the order the agent renders them. They can be interactive (tooltips, sorting, hover states) if the component supports it.

### 6. Form card — `ask()`

Inline form for user input. Visually distinct from display components — elevated card with border, shadow, and a submit button. Full details in the Forms section below.

---

## Interaction Flow — What the User Experiences

### 1. User sends a message

The user types into the input bar and hits Send (or Enter). Their message appears as a right-aligned bubble. The input bar clears but **remains enabled**.

Immediately, the agent's response block begins. The first element is an activity indicator (pulsing dot or shimmer) that will be replaced by the first code block or component.

### 2. Agent is executing code

As the agent streams TypeScript, a code block appears in the response area. It starts collapsed with a real-time line counter:

```
▸ Code ─────────────────────────────────── 3 lines ⟳
```

The `⟳` icon (or a subtle animation on the line count) indicates code is still streaming. If the user expands it, they see the code appearing in real time, syntax-highlighted.

### 3. A component appears (`display`)

When the agent calls `display(...)`, the component renders below the current code block. The code block above it finalizes (the `⟳` disappears, line count is final). If the agent continues writing code after the display, a new code block begins below the component.

The visual flow becomes:

```
▸ Code ─────────────────────────────────── 5 lines
┌── Restaurant List ──────────────────────────────┐
│  Flour + Water    ★ 4.7    $$     0.3 mi        │
│  Delfina          ★ 4.5    $$$    0.5 mi        │
│  ...                                            │
└─────────────────────────────────────────────────┘
▸ Code ─────────────────────────────────── 2 lines ⟳
```

### 4. The agent reads a value (`stop`)

When the agent calls `stop(...)` and the host injects a response, a read block appears in the flow:

```
▸ Code ─────────────────────────────────── 3 lines
▸ Read ─── { "restaurants.length": 8 }
▸ Code ─────────────────────────────────── 2 lines ⟳
```

The read block is compact — just one line collapsed. The user can see at a glance what the agent inspected. If they care about the full payload, they expand it.

### 5. A form appears (`ask`)

When the agent calls `ask(...)`, a form card renders in the response area. The activity indicator disappears — the agent is waiting for the user.

```
▸ Code ─────────────────────────────────── 4 lines
┌── form card ────────────────────────────────────┐
│                                                 │
│  Which restaurant?                              │
│  ┌──────────────────────────────────────────┐   │
│  │ Flour + Water                         ▾  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│                                  ┌──────────┐   │
│                                  │  Submit  │   │
│                                  └──────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

The form is the only element that blocks the agent. The user fills it in and clicks Submit. After submission:

1. The form card transitions to a **submitted state** — inputs become read-only, the card fades to muted styling, the submit button shows a brief checkmark.
2. The agent resumes silently (no message injected — per the protocol, `ask` resumes without a user message).
3. The agent then calls `stop` to read the values, which produces a read block.
4. A new code block or component follows.

**The submitted form and its values remain visible** in the scroll history. If the agent asks multiple questions during a session, each form appears at the point in the flow where the agent requested it. Previously submitted forms are muted. Only the latest unsubmitted form is active. The user scrolls through the history and sees the full sequence: code → component → form → read → code → component → form → read → ...

#### Form states

| State | Appearance |
|-------|------------|
| **Active** | Inputs enabled, submit button prominent, card has focus ring or glow |
| **Submitted** | Inputs read-only, values preserved, card muted, checkmark on button |
| **Timed out** | Card muted, label: "No response — the agent continued with defaults." |

### 6. An error occurs

An error block appears inline in the flow:

```
▸ Code ─────────────────────────────────── 6 lines
▸ Error ─── TypeError: Cannot read property 'name' of undefined
▸ Code ─────────────────────────────────── 3 lines ⟳
```

If the agent recovers (common case), the user sees the error collapsed with the agent continuing below it. They can expand to see details if curious. The flow isn't disrupted.

If the agent fails 3+ times consecutively, the error block changes to an **unrecovered** state:

```
▸ Error ─── TypeError: Cannot read property 'name' (failed after 3 attempts)
  ┌─────────────────────────────────────────────┐
  │  The agent couldn't recover from this error. │
  │  [Retry session]  [Send instructions]        │
  └─────────────────────────────────────────────┘
```

"Send instructions" focuses the message input, letting the user type guidance that gets injected as a user message.

### 7. Background tasks appear in the sidebar (`async`)

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

#### Task label

The sidebar card needs a human-readable label. Derived from:
1. A `//` comment immediately before the `async()` call (preferred — the agent should be instructed to comment before async).
2. The first function name inside the async body (e.g., `generateReport` → "Generating report").
3. Fallback: the task ID (`async_0`).

#### Task states

| State | Appearance |
|-------|------------|
| **Running** | Spinner or progress bar, elapsed time ticking, Cancel button visible |
| **Completed** | Green checkmark, final elapsed time, result summary (truncated), card fades after 5s |
| **Cancelled** | Orange "Cancelled" badge, card fades after 5s |
| **Failed** | Red "Error" badge, error message, card persists |

#### Cancelling a task

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

#### Sidebar behavior

- When no async tasks are running, the sidebar collapses to a small icon/badge in the top-right area of the interface.
- When tasks exist, the sidebar opens automatically. It can be manually collapsed.
- Completed/cancelled task cards fade out after 5 seconds to keep the sidebar clean. Failed task cards persist until the session ends.
- On mobile, the sidebar is a bottom sheet that slides up when tasks are active.

---

## User Intervention — Pause and Inject

The message input bar is **always enabled**, even while the agent is executing. This is the critical differentiator: the user can intervene at any moment.

### Input bar states

| State | Input bar | Buttons |
|-------|-----------|---------|
| **Agent executing** | Enabled, placeholder: "Send a message to the agent..." | **[Pause]** visible, **[Send]** visible |
| **Form active (`ask`)** | Enabled, placeholder: "Or type a message instead..." | **[Send]** visible, Pause hidden (already paused) |
| **Agent paused (by user)** | Enabled, placeholder: "The agent is paused. Type your message..." | **[Resume]** visible, **[Send]** visible |
| **Session complete** | Enabled, placeholder: "Send a follow-up..." | **[Send]** visible |

### Pause

The **Pause** button halts the agent's stream. No more code is executed. The current activity indicator freezes. The agent's response block shows a visible "⏸ Paused" badge.

While paused, the user can:
- **Type and send a message** — this is injected as a `role: 'user'` message in the conversation. The agent's existing code is finalized as an assistant message up to the pause point. The user's message is appended. When generation resumes, the agent sees the interruption and responds to it.
- **Click Resume** — generation continues from where it left off, with no interruption message.
- **Cancel the session** — ends the session entirely.

### Sending a message mid-execution (without pausing first)

If the user types a message and hits Send while the agent is running (without clicking Pause first), the system:

1. **Automatically pauses** the agent's stream.
2. **Finalizes** the agent's code so far as an assistant message.
3. **Appends** the user's message as a `role: 'user'` message.
4. **Resumes** generation — the agent continues, now aware of the user's interruption.

This is the fast path — the user just types and sends, and the system handles the pause/inject/resume transparently.

### What the user sees in the flow

When the user sends an intervention message, it appears as a **user bubble inside the agent's response block**, at the exact point where the interruption occurred:

```
▸ Code ─────────────────────────────────── 5 lines
┌── Restaurant List ──────────────────────────────┐
│  ...                                            │
└─────────────────────────────────────────────────┘
▸ Read ─── { "restaurants.length": 8 }

┌─── user message ────────────────────────────────┐
│  Actually, search for Japanese restaurants       │
│  instead.                                        │
└──────────────────────────────────────────────────┘

▸ Code ─────────────────────────────────── 4 lines ⟳
┌── Restaurant List ──────────────────────────────┐
│  Sushi Ran       ★ 4.8    $$$    0.2 mi         │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

The agent sees the interruption as a user message in context, adjusts its behavior, and continues. The user sees the entire history — original output, their intervention, and the agent's adjusted response — in a single scrollable flow.

### Sending a message while a form is active

If the user types a message and hits Send while an `ask` form is waiting for input, the system:

1. **Cancels** the form (treats it as if the user submitted empty / timed out).
2. **Resumes** the agent silently from the `ask` (with an empty/sentinel result).
3. **Injects** the user's message as a `role: 'user'` message (this will happen at the next `stop` boundary, or immediately if the agent has no `stop` between the `ask` and the next code).

Alternatively, the user can **both** fill in the form **and** add a comment. The system should provide a way to attach a note to a form submission — a small "Add a note" link below the Submit button that expands a text field. This note is injected as a user message right after the `ask` resumes and before the `stop`.

---

## Activity Indicator

The activity indicator signals the agent is executing code. It appears as the first element in a response block and reappears between components when the agent is working.

| Agent state | Indicator |
|-------------|-----------|
| Executing code (streaming) | Pulsing dot or shimmer. Adjacent to the current code block's `⟳` icon. |
| `display()` just rendered | Hidden briefly, reappears if agent continues |
| `ask()` form shown, waiting for user | Hidden — the form is the state |
| `stop()` in progress | Visible (resolves quickly, usually imperceptible) |
| Error recovery in progress | Visible, with the error block above it |
| Paused by user | Frozen, with "⏸ Paused" badge |
| Session complete | Hidden permanently |

The indicator is subtle — a small pulsing dot at the bottom of the response block, or a gentle shimmer on the current code block's header. It never overlays content.

---

## Scroll Behavior

- **Auto-scroll:** The viewport auto-scrolls to keep the latest content visible. If the user has manually scrolled up, auto-scroll pauses and a "↓ New content below" pill appears.
- **Smooth transitions:** New elements (components, forms, code blocks) use smooth scroll + fade-in.
- **Form focus:** When a form appears, the viewport scrolls to bring the form fully into view, and the first input is auto-focused.
- **User intervention:** When the user sends an interruption message, the viewport scrolls to show their message and the agent's continued response below it.

---

## Conversation History

Each completed session appears as a collapsible block in the history. The collapsed summary shows:

```
┌──────────────────────────────────────────────────────────┐
│  🔵 Agent  ·  Found 8 Italian restaurants, user picked   │
│            Flour + Water  ·  2 forms  ·  3 components    │
│                                          [Expand ▾]      │
└──────────────────────────────────────────────────────────┘
```

Expanding reveals the full flow — all code blocks (collapsed), read blocks, error blocks, rendered components, and forms in their original order. User intervention messages are preserved in place.

**Note:** The conversation history UI preserves **all** code and read payloads in their original, uncompressed form — even those that were compressed in the agent's context window during execution. Context window compression only affects what the agent can see in the LLM context, not what the user can review afterwards.

---

## Edge Cases

### Empty response

If the agent completes without any `display` or `ask` calls, the response block contains only code blocks (collapsed). Show a status line:

```
▸ Code ─────────────────────────────────── 12 lines
Done — no visible output.
```

### Very long sessions (20+ components)

After 10 components, group the remainder under an expandable section:

> *Showing 10 of 27 results* [Show all ▾]

Code and read blocks between components are preserved in the expansion.

### Context window compression (long sessions)

In long sessions, the host compresses older parts of the agent's context to stay within the LLM's window. The UI reflects this so the user understands what the agent can and cannot remember:

- **Summarized code blocks** appear as non-expandable, dimmed single lines: `▸ Code ── lines 1-12 · declared: input, restaurants ── (summarized)`. The full source is no longer available — but rendered components and forms from that era are **not** affected (they persist in the UI even though the code that produced them is summarized).
- **Decayed read blocks** show progressively less detail: first keys-only, then a count, then removed. Each stage is labeled ("keys only", "summarized") so the user can see the decay.
- **User messages are never compressed.** The user's original request and interventions always appear in full.

A **context budget indicator** appears at the bottom of the async sidebar (or in the header on mobile). It shows how much of the context window is in use:

```
Context: ━━━━━━━━━━━━━╺━━━━ 72%
```

When the context exceeds 80%, the indicator turns amber. At 95%, it turns red. The user can't directly control this — it's informational. But it helps them understand if the agent starts losing track of earlier context (because old code and reads are being compressed).

The indicator tooltip shows a breakdown: "System prompt: 15% · Code: 35% · Reads: 12% · Scope: 5% · Other: 5%".

### Concurrent form and display

If the agent calls `display()` before `ask()`, both appear in order — the component first, then the form. This is the expected pattern: show context, then ask a question.

### User refreshes mid-session

- **Active forms / running session:** Cannot be resumed. Show the last rendered state with a banner: "This session was interrupted. Send a new message to start over."
- **Completed sessions:** Fully preserved. All rendered components, submitted forms, and code blocks are restored.

### Async task completes while user is typing

The sidebar card updates to "Completed ✓". If the user is mid-interruption, the async result is queued and delivered in the next `stop` as normal. No disruption to the user's input.

### Multiple simultaneous async tasks

The sidebar shows all tasks. Each has its own card. Cards are ordered by creation time (newest at top). The user can cancel any individual task independently.

---

## Visual Design Tokens

### Colors

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `--surface-primary` | Chat background | `#FFFFFF` | `#1A1A1A` |
| `--surface-agent` | Agent response block | `#F8F9FA` | `#222222` |
| `--surface-form` | Active form card | `#FFFFFF` | `#2A2A2A` |
| `--surface-form-submitted` | Submitted form card | `#F0F0F0` | `#1E1E1E` |
| `--surface-code` | Code block (expanded) | `#F5F5F5` | `#1E1E1E` |
| `--surface-sidebar` | Async sidebar background | `#FAFAFA` | `#1E1E1E` |
| `--border-form` | Form card border | `#E2E8F0` | `#333333` |
| `--border-form-active` | Active form focus ring | `#3B82F6` | `#60A5FA` |
| `--border-code` | Code block border | `#E5E7EB` | `#2D2D2D` |
| `--border-read` | Read block left accent | `#93C5FD` | `#3B82F6` |
| `--border-error` | Error block left accent | `#FCA5A5` | `#DC2626` |
| `--border-hook` | Hook block left accent (observe/side-effect) | `#C4B5FD` | `#7C3AED` |
| `--border-hook-interrupt` | Hook block left accent (interrupt/skip) | `#FCD34D` | `#D97706` |
| `--accent` | Submit button, active states | `#2563EB` | `#3B82F6` |
| `--text-primary` | Body text | `#1A1A1A` | `#E5E5E5` |
| `--text-secondary` | Labels, hints, collapsed summaries | `#6B7280` | `#9CA3AF` |
| `--text-error` | Error messages | `#DC2626` | `#F87171` |
| `--text-code` | Code text (base) | `#1F2937` | `#D1D5DB` |
| `--indicator` | Activity indicator, streaming icon | `#3B82F6` | `#60A5FA` |
| `--async-running` | Async task spinner/progress | `#3B82F6` | `#60A5FA` |
| `--async-complete` | Async task done | `#16A34A` | `#4ADE80` |
| `--async-cancelled` | Async task cancelled | `#D97706` | `#FBBF24` |
| `--async-failed` | Async task error | `#DC2626` | `#F87171` |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| User message | System sans-serif | 400 | 15px |
| Component content | Inherited from component | — | — |
| Form labels | System sans-serif | 500 | 14px |
| Form inputs | System sans-serif | 400 | 15px |
| Submit button | System sans-serif | 600 | 14px |
| Collapsible headers (Code/Read/Error/Hook) | Monospace | 500 | 13px |
| Collapsible content (code) | Monospace | 400 | 13px |
| Read block payload | Monospace | 400 | 13px |
| Sidebar task labels | System sans-serif | 500 | 13px |
| Sidebar task details | System sans-serif | 400 | 12px |
| Status/muted text | System sans-serif | 400 | 13px |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--gap-message` | 16px | Between user bubble and agent block |
| `--gap-element` | 8px | Between elements within an agent response block |
| `--gap-form-fields` | 16px | Between form fields within an `ask` form |
| `--padding-form` | 20px | Inner padding of the form card |
| `--padding-code` | 12px | Inner padding of expanded code/read/error blocks |
| `--padding-component` | 16px | Inner padding of display components (if host-wrapped) |
| `--padding-sidebar` | 12px | Sidebar inner padding |
| `--radius-card` | 12px | Border radius on form cards and component wrappers |
| `--radius-code` | 8px | Border radius on code/read/error blocks |
| `--radius-input` | 8px | Border radius on input fields |
| `--radius-sidebar-card` | 8px | Border radius on async task cards |
| `--width-sidebar` | 280px | Async sidebar width (desktop) |

### Motion

| Transition | Duration | Easing | Usage |
|------------|----------|--------|-------|
| Component entry | 150ms | ease-out | `display` components fading in |
| Form entry | 200ms | ease-out | `ask` forms appearing |
| Form submit | 120ms | ease-in-out | Card muting + checkmark animation |
| Collapsible toggle | 150ms | ease-in-out | Code/read/error expand/collapse |
| Scroll to new content | 300ms | ease-in-out | Auto-scroll on new element |
| Sidebar open/close | 200ms | ease-in-out | Sidebar slide in/out |
| Sidebar card fade | 500ms | ease-out | Completed/cancelled tasks fading |
| User intervention | 200ms | ease-out | User bubble appearing mid-flow |

---

## Accessibility

- **Collapsibles:** Use `<details>`/`<summary>` or equivalent ARIA patterns (`aria-expanded`, `aria-controls`). Screen readers announce "Code block, 5 lines, collapsed" and "Read, restaurants.length is 8, collapsed."
- **Hook blocks:** Announce hook action: "Hook, delete-guard, interrupted, collapsed." For interrupt/skip hooks, also announce that the agent's behavior was altered.
- **Form inputs:** All inputs have associated labels. Focus order is top-to-bottom. Submit button is Tab-reachable.
- **Activity indicator:** `aria-live="polite"`, label: "Agent is working."
- **Async sidebar:** Tasks are announced as they appear (`aria-live="polite"`). Cancel button is labeled "Cancel task [name]."
- **User intervention:** When the user sends a mid-execution message, announce "Message sent to agent."
- **Pause/Resume:** Buttons are labeled with current state: "Pause agent execution" / "Resume agent execution."
- **Keyboard:** Enter sends message. Ctrl+Enter submits multi-field forms. Escape while form is active cancels the form. `Ctrl+Shift+P` toggles pause.
- **Color contrast:** All text meets WCAG AA. Left-border accents on read/error blocks are supplemented with icons (📖 for read, ⚠ for error) for color-blind users.
- **Reduced motion:** All transitions respect `prefers-reduced-motion: reduce`.

---

## Responsive Behavior

| Breakpoint | Layout change |
|------------|--------------|
| Desktop (>1024px) | Full layout. Async sidebar as a right rail (280px). |
| Tablet (768–1024px) | Full layout. Async sidebar as a bottom sheet (40% height), toggled by a floating badge. |
| Mobile (<768px) | Full-width. Async sidebar as a slide-up drawer. Forms and code blocks take full width. Pause button moves into a floating action area. |

On mobile, forms use native input behaviors (`type="number"` triggers numeric keyboard, etc.).

---

## Session Data Model (Frontend)

```ts
interface Session {
  id: string
  status: 'executing' | 'waiting_for_input' | 'paused' | 'complete' | 'error'
  blocks: Block[]
  activeFormId: string | null
  asyncTasks: AsyncTask[]
  contextBudget: ContextBudget
}

type Block =
  | { type: 'code'; id: string; lines: string[]; streaming: boolean; compression: 'none' | 'summarized'; declaredVars?: string[]; timestamp: number }
  | { type: 'read'; id: string; payload: Record<string, any>; fullPayload: Record<string, any>; compression: 'none' | 'keys_only' | 'summary' | 'removed'; timestamp: number }
  | { type: 'error'; id: string; errorType: string; message: string; source?: string; line?: number; recovered: boolean; attempts: number; compression: 'none' | 'summary' | 'removed'; timestamp: number }
  | { type: 'hook'; id: string; hookId: string; hookLabel: string; action: 'continue' | 'side_effect' | 'transform' | 'interrupt' | 'skip'; matchedSource: string; matchedLine: number; message?: string; timestamp: number }
  | { type: 'display'; id: string; component: React.ReactElement; timestamp: number }
  | { type: 'form'; id: string; component: React.ReactElement; status: 'active' | 'submitted' | 'timeout'; values?: Record<string, any>; timestamp: number }
  | { type: 'user_intervention'; id: string; message: string; timestamp: number }
  | { type: 'status'; id: string; text: string; timestamp: number }

interface AsyncTask {
  id: string               // e.g., "async_0"
  label: string            // human-readable label
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  startedAt: number
  completedAt?: number
  result?: any             // truncated result on completion
  error?: string           // error message on failure
  cancelMessage?: string   // user's cancel message
}

interface ContextBudget {
  usedTokens: number
  maxTokens: number
  percentage: number       // 0-100
  breakdown: {
    systemPrompt: number
    code: number
    reads: number
    scope: number
    other: number
  }
}
```

The `blocks` array is append-only during a session. The renderer walks it top-to-bottom. Code blocks are the only block type that can be in a "streaming" state (actively receiving lines). The `asyncTasks` array drives the sidebar.

**Compression fields:** Each code, read, and error block tracks its compression state. The UI stores the **full original data** in the block (e.g., `fullPayload` for reads) even when the agent's context has been compressed. This means the user can always review the complete history — the `compression` field just controls the visual styling (dimmed, labeled, non-expandable for summarized blocks). The context budget is updated by the host on every injection and pushed to the frontend.

---

## Protocol Impact — Updates to Runtime Contract

This UX specification introduces requirements that affect the host runtime:

### User intervention injection

When the user sends a message mid-execution (or while paused), the host must:

1. Pause the LLM stream (if not already paused).
2. Finalize the agent's code so far as `{ role: 'assistant', content: codeUpToPausePoint }`.
3. Append `{ role: 'user', content: userMessage }` (the raw text the user typed — no `←` prefix).
4. Update `{{SCOPE}}` in the system prompt.
5. Resume LLM generation.

The agent sees the user's message as a normal conversational turn and adjusts accordingly.

### Async task cancellation

When the user cancels an async task, the host must:

1. Abort the running task (terminate the promise / kill the function execution).
2. Store the cancellation result: `{ cancelled: true, message: "user's message" }`.
3. Deliver this in `asyncResults` on the next `stop` call, in place of the task's normal resolved value.

### Developer hook events

When hooks fire during execution, the host must push hook events to the frontend so they can be rendered as hook blocks:

1. After every hook fires, emit a `HookEvent` to the frontend with the hook ID, label, action type, matched source line, and any message.
2. For `interrupt` hooks, the host pauses the stream and injects the interrupt message as a `role: 'user'` message (prefixed with `⚠ [hook:${hookId}]`). The UI shows both the hook block and the agent's response to the interrupt.
3. For `skip` and `transform` hooks, the UI shows the hook block at the point in the flow where the hook altered execution. The agent is **not** aware of skips or transforms — only the user sees them.
4. For `side_effect` and `continue` hooks, the UI shows a minimal hook block. These are informational — no execution was altered.

### Distinguishing user messages

The agent now receives two types of user messages:

1. **Protocol injections:** `← stop { ... }` and `← error [Type] ...` — prefixed with `←`.
2. **Human messages:** The original request and any mid-execution interventions — no prefix.

The agent already handles both: the system prompt instructs it to respond to `← stop/error` by continuing code, and to respond to human messages by adjusting its approach. No system prompt changes are needed — the existing instruction "output only valid TypeScript" still applies, and the agent can use `//` comments to acknowledge the user's intervention before continuing.

---

## Summary: The User's Mental Model

From the user's perspective:

1. **I ask a question.** I type into the chat and hit send.
2. **The agent starts working.** I see collapsed code blocks ticking up as it writes code. A subtle indicator shows it's active.
3. **Results appear.** Components materialize — a list, a chart, a card. I can see the agent building an answer in real time.
4. **I can peek under the hood.** Expanding a code block shows me what the agent wrote. Expanding a read block shows me what it inspected. Errors show me what went wrong and whether it recovered.
5. **Sometimes the agent needs my input.** A form appears. I fill it in and submit.
6. **I can intervene anytime.** If I don't like where things are going, I type a message and send it. The agent sees my message and adjusts. I can also pause, or cancel background tasks from the sidebar.
7. **Background work happens in the sidebar.** I can see slow tasks running, check their progress, and cancel them with an explanation.
8. **It's done.** The indicator disappears. Everything is scrollable history. I can review every step the agent took, every value it read, every error it hit.

The process is transparent. The results are prominent. The user is in charge.

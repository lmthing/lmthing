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

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

## Table of Contents

- [Response Blocks](./response-blocks.md) — The 6 element types within an agent response block (code, read, error, hook, display, form)
- [Interaction Flow](./interaction-flow.md) — Step-by-step user experience and user intervention (pause, inject, mid-form messaging)
- [Async Sidebar](./async-sidebar.md) — Background task cards, cancellation, sidebar behavior
- [Visual Design](./visual-design.md) — Design tokens for colors, typography, spacing, and motion
- [Behavior](./behavior.md) — Activity indicator, scroll, conversation history, edge cases, accessibility, responsive layout
- [Data Model](./data-model.md) — Session data model, protocol contract updates, and user mental model summary

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

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

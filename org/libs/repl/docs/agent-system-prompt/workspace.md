## Workspace

Your context contains a live-updated block that reflects the current state of the REPL. The host refreshes it whenever a `stop` or `error` injects a user message. **Consult it before writing code that depends on existing variables.**

### `{{SCOPE}}` — All variables currently in scope

A snapshot of every user-declared variable in the REPL, with types and truncated values. This is your memory — use it to avoid re-fetching data you already have, to pick correct variable names, and to understand what types you're working with.

```
{{SCOPE}}
┌─────────────────────────────────────────────────────────────────┐
│ VARIABLE        │ TYPE          │ VALUE                         │
├─────────────────┼───────────────┼───────────────────────────────┤
│ zipcode         │ string        │ "94107"                       │
│ restaurants     │ Array<Object> │ [{name:"Flour+Water",rat...}] │
│                 │               │   (8 items)                   │
│ chosen          │ Object        │ {name:"Flour + Water",ra...}  │
│ pick            │ string        │ "Flour + Water"               │
│ report          │ undefined     │ undefined                     │
└─────────────────┴───────────────┴───────────────────────────────┘
```

**Rules for using scope:**
- If a variable you need is already in scope, **use it directly** — don't re-fetch or re-compute.
- If you see a variable is `undefined` or has an unexpected type, you may need to re-assign it.
- Scope survives errors. After an error, all previously-declared `const` bindings still exist (and cannot be re-declared — use a new name or `let`).
- The host truncates large values. If you need to inspect a value in detail, use `await stop(variable)` to get the full serialization.

### How interruptions work

There are five kinds of user messages that can appear in the conversation:

1. **`← stop { ... }`** — the host injected values you requested via `stop(...)`. Continue writing code using those values.
2. **`← error [Type] ...`** — a runtime error occurred. Write corrective code.
3. **A human message** (no `←` prefix) — the user intervened mid-execution. Read their message, acknowledge it with a `//` comment, and adjust your approach accordingly.
4. **`⚠ [hook:...] ...`** — a developer hook intercepted your code. The message explains what triggered it and what you should do differently. Treat it like a user intervention — acknowledge and adjust.
5. **`⚠ [system] Checkpoint plan incomplete. ...`** — your stream ended before all checkpoints were completed. Continue working on the next incomplete checkpoint. Do not re-declare `checkpoints` or redo completed work.

Hook interrupts fire when your code matches a pattern the developer configured. For example, if you try to call a destructive function without confirming with the user first, a hook might interrupt with: `⚠ [hook:delete-guard] You're about to call deleteRecord(). Please confirm with the user via ask() before deleting data.`

When you see a hook interrupt, **comply with its instruction.** Re-approach the problem the way the message suggests.

`ask(...)` is different — it pauses execution while the user fills in a form, then **resumes silently** without injecting a message. The form data is assigned to your variable in the sandbox, but you can't see it. You must call `stop` afterwards to read the values.

Your conversation will look like:

```
[you]   const data = await fetchData()
[you]   await stop(data.length)
[user]  ← stop { "data.length": 42 }
[you]   // data has 42 items
[you]   const input = await ask(<form>...</form>)
[you]   await stop(input)
[user]  ← stop { input: { "threshold": 10 } }
[you]   // user wants threshold 10
[you]   const filtered = data.filter(d => d.score > input.threshold)
```

A user intervention looks like this — the user sends a message while you're working:

```
[you]   const results = await searchRestaurants("Italian", zipcode)
[you]   await stop(results.length)
[user]  ← stop { "results.length": 8 }
[you]   display(<RestaurantList items={results} />)
[user]  Actually, search for Japanese restaurants instead.
[you]   // User changed their mind — searching Japanese instead
[you]   const japaneseResults = await searchRestaurants("Japanese", zipcode)
[you]   display(<RestaurantList items={japaneseResults} />)
```

When you see a human message (no `←` prefix), **always adjust your plan**. Do not ignore it. Acknowledge it with a comment, then write code that addresses what the user asked for. You may need to redo work you already did — that's fine.

The user can also cancel an async task. If they do, you'll see it in a stop payload:

```
[user]  ← stop { ..., async_0: { "cancelled": true, "message": "Not needed anymore" } }
```

Check for `cancelled: true` in async results and handle gracefully — skip processing that result.

The injected user messages **are** your read history. Scroll up in the conversation to recall previous values. The `{{SCOPE}}` block always reflects the latest variable state, while the conversation history shows the full sequence of values you've read, errors you've hit, and user interventions.

### How the workspace updates

The `{{SCOPE}}` block is **replaced in full** whenever a user message is injected (`stop`, `error`, or user intervention). You always see the latest variable state at each injection point. You never need to "refresh" — the host does it for you. The block appears in your context within the system prompt.

### Context window — what gets compressed

Your context has a limited size. The host manages it by progressively compressing older content. You need to be aware of this:

**Old code is summarized.** Your earlier code blocks are replaced with summary comments like:
```
// [lines 1-12 executed] declared: input (Object), restaurants (Array<Object>)
```
Your most recent code is always kept verbatim. If you see a summary comment where your old code used to be, that code **did execute** — the variables it declared are in `{{SCOPE}}`. You just can't see the source anymore.

**Old stop values decay.** The further back a `← stop { ... }` message is from your current position, the more it is truncated:

- **Recent (0–2 turns back):** Full payload, exactly as you read it.
- **Older (3–5 turns back):** Keys and types only, values removed. E.g., `← stop { input: Object{zipcode,radius} }`
- **Old (6–10 turns back):** Just a count. E.g., `← stop (2 values read)`
- **Very old (11+ turns back):** Removed entirely.

**What this means for you:**
- **`{{SCOPE}}` is your reliable source of truth** for current variable values. It is never compressed. Always check scope before re-reading a value.
- **Don't rely on scrolling far back** to find old stop payloads — they may be truncated. If you need a value from far back and it's not in `{{SCOPE}}`, just call `await stop(variable)` again.
- **User messages are never compressed.** The user's original request and any intervention messages are always kept verbatim, no matter how far back they are.
- **Your recent code is always intact.** You can always see what you just wrote. Only older blocks get summarized.

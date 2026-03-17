## 9. Workspace State Generation

The system prompt contains a template slot — `{{SCOPE}}` — that the host replaces with live data on **every context injection**. This gives the agent a persistent, up-to-date view of all variables in the REPL so it can avoid redundant `stop` calls and make better decisions about variable reuse.

Stop and ask values are **not** tracked in a separate log. They are delivered as `role: 'user'` messages in the conversation history, which the agent can read directly by scrolling up. This avoids duplication and keeps the context lean.

### When to regenerate

Regenerate the scope block and replace it in the system prompt content whenever:
- A `stop()` is called (before injecting the stop payload)
- An error occurs (before injecting the error)
- A user intervention message is sent (before injecting the user message)
- Optionally: periodically during long uninterrupted execution stretches (every ~20 lines)

Note: `ask()` does **not** trigger a scope update or message injection. The scope is updated when the agent subsequently calls `stop()` to read the form data.

The system prompt in the conversation history is **mutable** — on each injection, the host replaces the `{{SCOPE}}` marker in the system message with fresh content.

### `{{SCOPE}}` — Variable Scope Snapshot

The host introspects the sandbox to enumerate all user-declared variables, their types, and truncated values.

#### Implementation

```ts
interface ScopeEntry {
  name: string
  type: string       // typeof result or constructor name
  value: string      // truncated serialized value
}

function generateScopeTable(sandbox: vm.Context): string {
  const entries: ScopeEntry[] = []

  // Get all user-declared variable names from the scope tracker
  for (const name of scopeTracker.declaredVariables) {
    // Skip injected globals
    if (INJECTED_GLOBALS.has(name)) continue

    const raw = sandbox[name]
    entries.push({
      name,
      type: describeType(raw),
      value: truncateValue(raw),
    })
  }

  return formatAsTable(entries)
}

function describeType(val: any): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Array<never>'
    const inner = describeType(val[0])
    return `Array<${inner}>`
  }
  if (typeof val === 'object') {
    return val.constructor?.name ?? 'Object'
  }
  return typeof val // string, number, boolean, function, symbol, bigint
}

function truncateValue(val: any, maxLen: number = 50): string {
  const json = safeStringify(val)
  if (json.length <= maxLen) return json
  return json.slice(0, maxLen - 3) + '...'
}
```

#### Scope Tracking

The host must track which variable names the agent has declared. Options:

1. **AST analysis:** Before executing each statement, parse it and extract `const`/`let`/`var` declarations and destructuring bindings. Maintain a `Set<string>` of declared names.
2. **Scope diffing:** After each execution, compare `Object.keys(sandbox)` against the previous snapshot. New keys are user-declared variables.
3. **Proxy-based:** Wrap the sandbox context in a Proxy that traps `set` operations.

Option 1 is most reliable. Option 2 is simplest but can miss variables that shadow existing globals.

#### Output Format

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

For arrays, append `(N items)` on a continuation line. For objects, append `(N keys)` if truncated. For strings, show the quoted and truncated value. For functions, show `[Function]`.

#### Size Limits

| Constraint | Limit |
|-----------|-------|
| Max variables shown | 50 (alphabetical, most recent declarations first if over limit) |
| Max value column width | 50 characters |
| Array element preview | First 3 elements, then `... +N more` |
| Object key preview | First 5 keys, then `... +N more` |
| Nested depth | 2 levels max |
| Total scope block size | ~3000 tokens (truncate oldest variables if exceeded) |

### System Prompt Mutation

The host treats the system prompt as a template with a live slot. On every injection:

```ts
function updateSystemPrompt(
  template: string,
  sandbox: vm.Context
): string {
  const scopeBlock = generateScopeTable(sandbox)
  return template.replace(/{{SCOPE}}[\s\S]*?(?=┌|{{|$)/, scopeBlock)
}
```

**Important:** The scope block is replaced in the **system message**, not appended as a new message. This keeps it in a fixed location in the context window and avoids bloating the conversation history. The agent always sees the latest scope in the same place.

---

## 10. Conversation Context Management

The LLM's conversation context has two mutable parts:
1. The **system prompt** — mutated in place to keep `{{SCOPE}}` current.
2. The **message log** — an append-only sequence of `assistant` and `user` messages.

Only `stop` and `error` create turn boundaries. `ask` resumes silently — the agent's assistant turn continues unbroken through an `ask` call. A turn boundary is created when the agent subsequently calls `stop` to read the form values.

```
[system]     System prompt (with filled signatures and live {{SCOPE}})
[user]       User's original request
[assistant]  <code block 1: ...ask(form)...stop(input)>
[user]       ← stop { input: { "city": "Tokyo", "budget": 200 } }
[assistant]  <code block 2: ...computation...>
[user]       ← stop { "results.length": 8 }
[assistant]  <code block 3: ...bad code...>
[user]       ← error [TypeError] Cannot read property 'name' of undefined
[assistant]  <recovery code>
```

The injected `user` messages serve as the agent's read history. The conversation itself **is** the log of all values the agent has inspected — no separate tracking structure is needed.

### Context Window Management

The conversation grows with every turn. Without management, long sessions will exceed the LLM's context window. The host applies **two progressive compression strategies**: code summarization and stop payload decay.

#### Strategy 1: Code Window — Sliding window over assistant turns

The host maintains a **code window** — only the most recent N lines of agent code are kept verbatim. Older code is replaced with a summary comment that preserves the information the agent needs (what was done, what variables were created) without the full source.

**Parameters:**
- `codeWindowLines`: Maximum total lines of agent code kept verbatim across all assistant turns. Default: 200.
- `codeSummaryStrategy`: How to summarize evicted code. Default: `"declaration_summary"`.

**How it works:**

When the total lines of agent code across all assistant turns exceeds `codeWindowLines`, the host replaces the **oldest** assistant turns (starting from the first) with summary comments. The most recent turn is never summarized — it is always kept verbatim.

**Before compression:**
```
[assistant]  const input = await ask(                          ← turn 1 (12 lines)
               <form>
                 <TextInput name="zipcode" label="Zip" />
               </form>
             )
             await stop(input)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  const restaurants = await search(                  ← turn 2 (8 lines)
               "Italian", { near: input.zipcode, limit: 10 }
             )
             await stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  display(<RestaurantList items={restaurants} />)    ← turn 3 (current, 15 lines)
             const choice = await ask(...)
             await stop(choice)
```

**After compression (turn 1 evicted):**
```
[assistant]  // [lines 1-12 executed] declared: input (Object)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  const restaurants = await search(                  ← turn 2 kept
               "Italian", { near: input.zipcode, limit: 10 }
             )
             await stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  display(<RestaurantList items={restaurants} />)    ← turn 3 (current, always kept)
             const choice = await ask(...)
             await stop(choice)
```

**Summary comment format:**
```
// [lines N-M executed] declared: varA (Type), varB (Type), varC (Type)
```

The summary includes:
- Line range that was summarized
- All variables declared in that block with their types (from the scope tracker)
- No values — values are available in `{{SCOPE}}` if still relevant

**Implementation:**

```ts
interface CodeTurn {
  index: number
  lines: string[]
  lineCount: number
  declaredVariables: Array<{ name: string; type: string }>
}

function compressCodeWindow(
  turns: CodeTurn[],
  maxLines: number
): Array<{ role: 'assistant'; content: string }> {
  // Calculate total lines
  let totalLines = turns.reduce((sum, t) => sum + t.lineCount, 0)

  // Never compress the most recent turn
  const result: Array<{ role: 'assistant'; content: string }> = []
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const isLastTurn = i === turns.length - 1

    if (!isLastTurn && totalLines > maxLines) {
      // Summarize this turn
      const vars = turn.declaredVariables
        .map(v => `${v.name} (${v.type})`)
        .join(', ')
      const summary = `// [lines ${turn.lines[0]}-${turn.lines[turn.lineCount - 1]} executed]`
        + (vars ? ` declared: ${vars}` : '')
      result.push({ role: 'assistant', content: summary })
      totalLines -= (turn.lineCount - 1)  // summary = 1 line
    } else {
      // Keep verbatim
      result.push({ role: 'assistant', content: turn.lines.join('\n') })
    }
  }

  return result
}
```

#### Strategy 2: Stop Payload Decay — Progressive truncation by distance

Stop payloads (`← stop { ... }`) are progressively truncated the further they are from the current execution point. Recent reads are kept in full; older reads are compressed to key-only summaries or removed entirely.

**Decay tiers:**

| Distance from current turn | Treatment | Example |
|---------------------------|-----------|---------|
| 0–2 turns back | **Full** — payload kept verbatim | `← stop { input: { "zipcode": "94107", "radius": 10 } }` |
| 3–5 turns back | **Keys only** — values replaced with types | `← stop { input: Object{zipcode,radius} }` |
| 6–10 turns back | **Summary** — single-line count | `← stop (2 values read)` |
| 11+ turns back | **Removed** — the `[user]` turn is dropped entirely | *(gap in conversation)* |

**The agent is told about this.** The system prompt explains that older stop values are truncated and that `{{SCOPE}}` is the reliable source for current variable values. If the agent needs a historical value that has been truncated, it can re-read it with `await stop(variable)`.

**Implementation:**

```ts
interface StopTurn {
  index: number
  payload: Record<string, any>
  distanceFromCurrent: number  // how many turns ago
}

function decayStopPayload(turn: StopTurn): string {
  const d = turn.distanceFromCurrent

  if (d <= 2) {
    // Full — keep verbatim
    return `← stop ${JSON.stringify(turn.payload, null, 2)}`
  }

  if (d <= 5) {
    // Keys only — replace values with type summaries
    const keySummary = Object.entries(turn.payload).map(([k, v]) => {
      return `${k}: ${describeTypeBrief(v)}`
    }).join(', ')
    return `← stop { ${keySummary} }`
  }

  if (d <= 10) {
    // Count only
    const count = Object.keys(turn.payload).length
    return `← stop (${count} value${count !== 1 ? 's' : ''} read)`
  }

  // 11+ turns: remove entirely
  return null  // signal to drop this user turn
}

function describeTypeBrief(val: any): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') return `"${val.slice(0, 20)}${val.length > 20 ? '...' : ''}"`
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) return `Array(${val.length})`
  if (typeof val === 'object') {
    const keys = Object.keys(val).slice(0, 5).join(',')
    return `Object{${keys}${Object.keys(val).length > 5 ? ',…' : ''}}`
  }
  return typeof val
}
```

### `{{TASKS}}` Block — Task State Injection

On every `stop()` call, the host appends a `{{TASKS}}` section to the injected user message showing the current state of all active tasklists. This gives the agent visibility into which tasks are ready, running, completed, failed, or skipped — essential for navigating a DAG.

#### `generateTasksBlock` Implementation

```ts
function generateTasksBlock(tasklistsState: TasklistsState): string | null {
  if (tasklistsState.tasklists.size === 0) return null

  const lines: string[] = ['{{TASKS}}']

  for (const [tasklistId, state] of tasklistsState.tasklists) {
    const headerLine = `┌ ${tasklistId} ${'─'.repeat(Math.max(1, 60 - tasklistId.length - 3))}┐`
    lines.push(headerLine)

    for (const task of state.plan.tasks) {
      const completion = state.completed.get(task.id)
      let symbol: string, detail: string

      if (completion?.status === 'completed') {
        const outputStr = JSON.stringify(completion.output)
        const truncated = outputStr.length > 40 ? outputStr.slice(0, 37) + '...' : outputStr
        symbol = '✓'; detail = `→ ${truncated}`
      } else if (completion?.status === 'failed') {
        symbol = '✗'; detail = `— ${completion.error}`
      } else if (completion?.status === 'skipped') {
        symbol = '⊘'; detail = `(skipped — condition was falsy)`
      } else if (state.runningTasks.has(task.id)) {
        const progress = state.progressMessages?.get(task.id)
        symbol = '◉'; detail = progress ? `(running — ${progress.percent ?? ''}% ${progress.message})` : '(running)'
      } else if (state.readyTasks.has(task.id)) {
        symbol = '◎'; detail = '(ready — deps satisfied)'
      } else {
        const deps = task.dependsOn?.join(', ') ?? ''
        symbol = '○'; detail = `(blocked — waiting on: ${deps})`
      }

      lines.push(`│ ${symbol} ${task.id.padEnd(18)} ${detail.padEnd(40)}│`)
    }

    lines.push(`└${'─'.repeat(63)}┘`)
  }

  return lines.join('\n')
}
```

#### Integration with `stop()`

The `{{TASKS}}` block is appended after the stop payload in the `← stop` user message:

```ts
// In stop() implementation, after building payload:
const tasksBlock = generateTasksBlock(tasklistsState)
const message = tasksBlock
  ? `← stop ${JSON.stringify(payload, null, 2)}\n\n${tasksBlock}`
  : `← stop ${JSON.stringify(payload, null, 2)}`
streamController.injectUserMessage(message)
```

#### `{{TASKS}}` Decay Tiers

The `{{TASKS}}` block follows its own decay schedule, separate from stop payload decay:

| Distance from current turn | Treatment |
|---------------------------|-----------|
| 0–2 turns | **Full** — complete table with outputs |
| 3–5 turns | **Compact** — status symbols + task names only (no outputs) |
| 6+ turns | **Removed** — task state is always fresh in latest stop |

Implementation:

```ts
function decayTasksBlock(tasksBlock: string, distance: number): string | null {
  if (distance <= 2) return tasksBlock  // full
  if (distance <= 5) {
    // Strip output details, keep just symbols and task names
    return tasksBlock.split('\n').map(line => {
      const match = line.match(/^│ ([✓✗⊘◉◎○]) (\S+)/)
      if (match) return `│ ${match[1]} ${match[2]}`
      return line
    }).join('\n')
  }
  return null  // removed
}
```

#### When no stop is called
- Task state also appears in the incomplete task reminder message (same format)
- Task state is NOT in `{{SCOPE}}` — it's a separate concern (variables vs. plan progress)
- Only shown when at least one tasklist exists

#### Error turns

Error injections (`← error [Type] ...`) follow the same decay as stop payloads:
- Recent errors: kept in full (the agent may still need the context for recovery).
- Old errors: compressed to `← error [Type] (recovered)` or removed.

#### User intervention messages

Human messages (user interventions) are **never truncated or removed** — they represent the user's intent and may be critical context for the agent's ongoing plan. They are always kept verbatim regardless of distance.

#### Combined compression flow

On every context injection, the host runs both strategies:

```ts
function compressContext(messages: Message[], config: ContextWindowConfig): Message[] {
  const compressed: Message[] = []

  // 1. System prompt — always kept (with live {{SCOPE}})
  compressed.push(messages[0])

  // 2. Original user request — always kept
  compressed.push(messages[1])

  // 3. Process conversation turns
  const turns = parseTurns(messages.slice(2))
  const currentTurnIndex = turns.length - 1

  for (const turn of turns) {
    const distance = currentTurnIndex - turn.index

    if (turn.role === 'assistant') {
      // Apply code window compression
      compressed.push(compressCodeTurn(turn, distance, config))
    } else if (turn.role === 'user') {
      if (turn.isProtocol && turn.type === 'stop') {
        // Apply stop payload decay
        const decayed = decayStopPayload({ ...turn, distanceFromCurrent: distance })
        if (decayed !== null) {
          compressed.push({ role: 'user', content: decayed })
        }
        // else: 11+ turns back, drop entirely
      } else if (turn.isProtocol && turn.type === 'error') {
        // Apply same decay to errors
        const decayed = decayErrorPayload(turn, distance)
        if (decayed !== null) {
          compressed.push({ role: 'user', content: decayed })
        }
      } else {
        // Human message (intervention or original request) — always keep
        compressed.push({ role: 'user', content: turn.content })
      }
    }
  }

  return compressed
}
```

#### Token budget enforcement

After applying both strategies, the host checks the total token count. If it still exceeds `maxContextTokens`, it applies more aggressive eviction:

1. Increase code summarization — evict more turns (but never the current turn).
2. Shrink the "full" stop payload window from 2 turns to 1, then 0.
3. Shrink `{{SCOPE}}` value truncation — reduce `maxScopeValueWidth` from 50 to 30 chars.
4. If still over budget, summarize the system prompt's function/component signatures to just names and return types.

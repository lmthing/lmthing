## 13. Message Wire Format

```ts
// Initial request — workspace slots are empty
const systemPrompt = buildSystemPrompt({
  functionSignatures,
  componentSignatures,
  scope: '(no variables yet)',
})

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userMessage }
]

// After stop() — update scope in system prompt, then append injection as user message:
messages[0].content = buildSystemPrompt({
  functionSignatures,
  componentSignatures,
  scope: generateScopeTable(sandbox),
})
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: '← stop { "count": 47 }' }
)

// After error — same pattern:
messages[0].content = buildSystemPrompt({ /* ... updated scope ... */ })
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: '← error [TypeError] Cannot read property...\n    at line 14: ...' }
)

// After ask() — NO message is appended. The form data is assigned to the
// sandbox variable and generation resumes. The agent's assistant turn
// continues unbroken. The values become visible when the agent calls stop():
//
//   [assistant]  const input = await ask(<form>...</form>)  ← pauses here, form shown
//                                                            ← user submits, input assigned
//                await stop(input)                           ← agent continues, then stops
//   [user]       ← stop { input: { "city": "Tokyo" } }      ← NOW the turn boundary happens

// After user intervention — raw message, no ← prefix:
messages[0].content = buildSystemPrompt({ /* ... updated scope ... */ })
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: 'Actually, search for Japanese restaurants instead.' }
)
// Agent resumes, sees the human message, and adjusts.
```

---

## 14. Type Definitions

```ts
// Host-injected globals
declare function stop(...values: any[]): Promise<void>
declare function display(element: React.ReactElement): void
declare function ask(formElement: React.ReactElement): Promise<Record<string, any>>
declare function async(fn: () => Promise<void>): void
declare function checkpoints(plan: CheckpointPlan): void
declare function checkpoint(id: string, output: Record<string, any>): void

// Injection payloads (only stop and error inject user messages)
interface StopPayload {
  [argNameOrExpression: string]: SerializedValue
}

interface ErrorPayload {
  type: string
  message: string
  line: number
  source: string
}

type SerializedValue =
  | string | number | boolean | null
  | 'undefined' | '[Circular]'
  | `[Function: ${string}]`
  | `[Error: ${string}]`
  | `[Promise: ${'pending' | 'resolved' | 'rejected'}]`
  | SerializedValue[]
  | { [key: string]: SerializedValue }
  | 'pending'
  | AsyncCancellation

// Async task cancellation (delivered via stop payload)
interface AsyncCancellation {
  cancelled: true
  message: string    // user's optional explanation, "" if none
}

// Ask form cancellation (when user intervenes during ask)
interface AskCancellation {
  _cancelled: true
}

// Session configuration
interface SessionConfig {
  functionTimeout: number       // default: 30_000
  askTimeout: number            // default: 300_000
  sessionTimeout: number        // default: 600_000
  maxStopCalls: number          // default: 50
  maxAsyncTasks: number         // default: 10
  maxCheckpointReminders: number // default: 3 — max times host re-prompts agent to finish checkpoints
  maxContextTokens: number      // default: 100_000
  serializationLimits: {
    maxStringLength: number     // default: 2_000
    maxArrayElements: number    // default: 50
    maxObjectKeys: number       // default: 20
    maxDepth: number            // default: 5
  }
  workspace: {
    maxScopeVariables: number   // default: 50
    maxScopeValueWidth: number  // default: 50 chars
    maxScopeTokens: number      // default: 3_000
  }
  contextWindow: {
    codeWindowLines: number     // default: 200 — max total lines of agent code kept verbatim
    stopDecayTiers: {           // distance thresholds for stop payload truncation
      full: number              // default: 2 — turns 0-2 kept verbatim
      keysOnly: number          // default: 5 — turns 3-5 compressed to keys+types
      summary: number           // default: 10 — turns 6-10 compressed to count
                                // turns 11+ removed entirely
    }
    neverTruncateInterventions: boolean  // default: true — human messages always kept
  }
}

// Workspace generation
interface ScopeEntry {
  name: string
  type: string
  value: string   // truncated serialized value
}

// Checkpoint types
interface CheckpointTask {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
}

interface CheckpointPlan {
  description: string
  tasks: CheckpointTask[]
}

interface CheckpointCompletion {
  output: Record<string, any>
  timestamp: number
}

interface CheckpointState {
  plan: CheckpointPlan | null
  completed: Map<string, CheckpointCompletion>
  currentIndex: number
}

// Developer hooks (§8)
interface Hook {
  id: string
  label: string
  pattern: ASTPattern
  phase: 'before' | 'after'
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

type ASTPattern =
  | { type: string; [property: string]: any }        // node type + property filters
  | { oneOf: ASTPattern[] }                           // OR combinator
  | { type: string; not: ASTPattern }                 // negation

interface HookMatch {
  node: ts.Node
  source: string
  captures: Record<string, ts.Node>
  line: number
}

interface HookContext {
  scope: Record<string, any>
  session: { id: string; turnIndex: number; lineIndex: number }
  ast: ts.SourceFile
  asyncTasks: Map<string, { status: string }>
}

type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }
```

---

## 15. Worked Example — Full Trace

User: *"Find me Italian restaurants nearby and help me pick one."*

### Message log as it builds up

```
[system]  <system prompt with {{SCOPE}}: (no variables yet)>
[user]    Find me Italian restaurants nearby and help me pick one.
```

### Execution trace

```
AGENT OUTPUT                              HOST ACTION
──────────────────────────────────────────────────────────────
// Let's find Italian restaurants        [noop — comment]

const input = await ask(                 [accumulate multi-line...]
  <form>
    <TextInput name="zipcode"
      label="What's your zip code?" />
  </form>
)                                        [execute ask() → render form, PAUSE]

                                         [User types "94107", submits]
                                         [assign: input = { zipcode: "94107" }]
                                         [RESUME silently — no message appended]

await stop(input)                        [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input │ Object │ { zipcode: "94107" }
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code so far>' }
                                         │  { role: 'user', content: '← stop { input: { "zipcode": "94107" } }' }
                                         [RESUME generation]

// User wants zipcode 94107              [noop]
const restaurants = await search(        [execute search()]
  "Italian restaurants",
  { near: input.zipcode, limit: 10 }
)

await stop(restaurants.length)           [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input       │ Object        │ { zipcode: "94107" }
                                         │  restaurants │ Array<Object> │ [{name:"Flour+W...}] (8)
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code since last pause>' }
                                         │  { role: 'user', content: '← stop { "restaurants.length": 8 }' }
                                         [RESUME]

// Found 8 options                       [noop]
display(                                 [accumulate...]
  <RestaurantList
    items={restaurants.slice(0, 5)}
  />
)                                        [execute display() → render, continue]

const choice = await ask(                [accumulate...]
  <form>
    <Select name="pick"
      label="Which one?"
      options={restaurants
        .slice(0, 5)
        .map(r => r.name)} />
  </form>
)                                        [execute ask() → render form, PAUSE]

                                         [User selects "Flour + Water", submits]
                                         [assign: choice = { pick: "Flour + Water" }]
                                         [RESUME silently — no message appended]

await stop(choice)                       [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input       │ Object        │ { zipcode: "94107" }
                                         │  restaurants │ Array<Object> │ [{name:"Flour+W...}] (8)
                                         │  choice      │ Object        │ { pick: "Flour + Water" }
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code since last pause>' }
                                         │  { role: 'user', content: '← stop { choice: { "pick": "Flour + Water" } }' }
                                         [RESUME]

// User picked Flour + Water             [noop]
const chosen = restaurants.find(         [execute]
  r => r.name === choice.pick
)

display(                                 [accumulate...]
  <RestaurantCard
    restaurant={chosen}
    showBooking={true}
  />
)                                        [execute display() → render]

// Done!                                 [LLM stop token → session complete]
```

### Final message log

```
[system]     <system prompt with {{SCOPE}} showing input, restaurants, choice, chosen>
[user]       Find me Italian restaurants nearby and help me pick one.
[assistant]  // Let's find...\nconst input = await ask(...)\nawait stop(input)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  // User wants zipcode 94107\nconst restaurants = await search(...)\nawait stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  // Found 8...\ndisplay(...)\nconst choice = await ask(...)\nawait stop(choice)
[user]       ← stop { choice: { "pick": "Flour + Water" } }
[assistant]  // User picked...\nconst chosen = ...\ndisplay(...)\n// Done!
```

Note how the `ask` calls do **not** produce turn boundaries — the agent's assistant turn continues unbroken through `ask` into the subsequent `stop`. The only `[user]` messages are `← stop` injections. This keeps `stop` as the single, uniform mechanism for the agent to read any value.

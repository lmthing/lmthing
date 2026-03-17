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
declare function tasklist(tasklistId: string, description: string, tasks: TaskDefinition[]): void
declare function completeTask(tasklistId: string, id: string, output: Record<string, any>): void
declare function completeTaskAsync(tasklistId: string, taskId: string, fn: () => Promise<Record<string, any>>): void
declare function taskProgress(tasklistId: string, taskId: string, message: string, percent?: number): void
declare function failTask(tasklistId: string, taskId: string, error: string): void
declare function retryTask(tasklistId: string, taskId: string): void
declare function sleep(seconds: number): Promise<void>
declare function loadKnowledge(selector: KnowledgeSelector): KnowledgeContent

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
  maxTasklistReminders: number   // default: 3 — max times host re-prompts agent to finish incomplete tasks
  maxContextTokens: number      // default: 100_000
  maxTaskRetries: number        // default: 3
  maxTasksPerTasklist: number   // default: 20
  taskAsyncTimeout: number      // default: 60_000
  sleepMaxSeconds: number       // default: 30
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

// Tasklist types
type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped'

interface TaskDefinition {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
  dependsOn?: string[]         // task IDs that must complete first
  condition?: string           // JS expression; if falsy, auto-skip
  optional?: boolean           // if true, failure doesn't block dependents
}

interface Tasklist {
  tasklistId: string
  description: string
  tasks: TaskDefinition[]
}

interface TaskCompletion {
  output: Record<string, any>
  timestamp: number
  status: 'completed' | 'failed' | 'skipped'  // outcome of this task
  error?: string               // present when status is 'failed'
  duration?: number            // ms from running → completion
}

interface TasklistState {
  plan: Tasklist
  completed: Map<string, TaskCompletion>
  readyTasks: Set<string>      // tasks whose deps are all satisfied
  runningTasks: Set<string>    // async tasks currently executing
  outputs: Map<string, Record<string, any>>  // completed task outputs for condition eval
}

interface TasklistsState {
  tasklists: Map<string, TasklistState>
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

User: *"Research AI frameworks and build a comparison report."*

### Message log as it builds up

```
[system]  <system prompt with {{SCOPE}}: (no variables yet), {{TASKS}}: (none)>
[user]    Research AI frameworks and build a comparison report.
```

### Execution trace

```
AGENT OUTPUT                              HOST ACTION
──────────────────────────────────────────────────────────────
// Plan the research pipeline            [noop — comment]

tasklist("research", "AI framework       [execute tasklist() → register DAG]
  comparison report", [                  [readyTasks: {fetch_sources, fetch_benchmarks}]
  {                                      [runningTasks: {}]
    id: "fetch_sources",
    instructions: "Fetch docs and
      GitHub stats for top frameworks",
    outputSchema: {
      frameworks: { type: "array" }
    }
  },
  {
    id: "fetch_benchmarks",
    instructions: "Fetch latest
      benchmark results",
    outputSchema: {
      benchmarks: { type: "array" }
    }
  },
  {
    id: "analyze",
    instructions: "Compare frameworks
      across dimensions",
    outputSchema: {
      comparison: { type: "object" }
    },
    dependsOn: ["fetch_sources",
      "fetch_benchmarks"]
  },
  {
    id: "write_report",
    instructions: "Write the full
      comparison report",
    outputSchema: {
      report: { type: "string" },
      words: { type: "number" }
    },
    dependsOn: ["analyze"]
  },
  {
    id: "publish",
    instructions: "Publish report to
      the knowledge base",
    outputSchema: {
      url: { type: "string" }
    },
    dependsOn: ["write_report"],
    condition: "write_report.words > 100",
    optional: true
  }
])

// Kick off both fetch tasks             [noop]
// concurrently

completeTaskAsync("research",            [execute completeTaskAsync()]
  "fetch_sources", async () => {         [status: fetch_sources → running]
  const r = await fetchDocs([            [runningTasks: {fetch_sources}]
    "pytorch", "tensorflow",
    "jax", "keras"
  ])
  return { frameworks: r }
})

completeTaskAsync("research",            [execute completeTaskAsync()]
  "fetch_benchmarks", async () => {      [status: fetch_benchmarks → running]
  const b = await fetchBenchmarks(       [runningTasks: {fetch_sources,
    "2025-mlperf"                            fetch_benchmarks}]
  )
  return { benchmarks: b }
})

// Wait for both fetches to finish       [noop]
await sleep(5)                           [execute sleep(5) → PAUSE 5s, RESUME]

await stop()                             [execute stop() → PAUSE]
                                         [async results resolved by now:]
                                         [  fetch_sources → completed]
                                         [  fetch_benchmarks → completed]
                                         [readyTasks: {analyze}]
                                         [UPDATE {{SCOPE}}: (no user-declared vars)]
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code so far>' }
                                         │  { role: 'user', content:
                                         │    '← stop {}\n\n{{TASKS}}\n
                                         │    ## Tasklist: research
                                         │    AI framework comparison report
                                         │
                                         │    - [x] fetch_sources ✓
                                         │      output: { frameworks: [{name:"PyTorch",...}, ...] (4) }
                                         │    - [x] fetch_benchmarks ✓
                                         │      output: { benchmarks: [{suite:"MLPerf",...}, ...] (3) }
                                         │    - [ ] analyze (ready)
                                         │      depends on: fetch_sources, fetch_benchmarks
                                         │    - [ ] write_report (pending)
                                         │      depends on: analyze
                                         │    - [ ] publish (pending, optional)
                                         │      depends on: write_report
                                         │      condition: write_report.words > 100' }
                                         [RESUME generation]

// Both fetches complete, analyze next   [noop]

const comparison = {                     [execute — build comparison object]
  dimensions: ["performance",
    "ecosystem", "ease_of_use",
    "production_ready"],
  rankings: analyzeFrameworks(
    fetch_sources.output.frameworks,
    fetch_benchmarks.output.benchmarks
  )
}

completeTask("research", "analyze",      [execute completeTask()]
  { comparison })                        [status: analyze → completed]
                                         [readyTasks: {write_report}]

// Now write the report                  [noop]

const report = generateReport(           [execute]
  comparison
)

completeTask("research",                 [execute completeTask()]
  "write_report", {                      [status: write_report → completed]
  report: report.text,                   [readyTasks: {publish}]
  words: report.wordCount                [evaluate condition:
})                                           write_report.words (850) > 100 → true]
                                         [publish remains ready]

// Condition met, publish the report     [noop]

const url = await publishToKB(           [execute]
  report.text,
  "ai-framework-comparison"
)

completeTask("research", "publish",      [execute completeTask()]
  { url })                               [status: publish → completed]
                                         [all tasks completed]

display(                                 [accumulate...]
  <ReportCard
    title="AI Framework Comparison"
    url={url}
    wordCount={report.wordCount}
    frameworks={comparison.rankings
      .map(r => r.name)}
  />
)                                        [execute display() → render]

// Done!                                 [LLM stop token → session complete]
```

### Alternate path: condition not met

If `write_report.words` had been `80` (below the threshold of `100`), the host would have auto-skipped `publish`:

```
completeTask("research",                 [execute completeTask()]
  "write_report", {                      [status: write_report → completed]
  report: report.text,                   [evaluate condition:
  words: 80                                  write_report.words (80) > 100 → false]
})                                       [status: publish → skipped (condition falsy)]
                                         [all tasks completed — publish was optional]
```

### Final message log

```
[system]     <system prompt with {{SCOPE}} showing comparison, report, url;
              {{TASKS}}: research — all 5 tasks completed>
[user]       Research AI frameworks and build a comparison report.
[assistant]  // Plan the research pipeline\ntasklist("research", ...)\n
             completeTaskAsync("research", "fetch_sources", ...)\n
             completeTaskAsync("research", "fetch_benchmarks", ...)\n
             await sleep(5)\nawait stop()
[user]       ← stop {}

             {{TASKS}}
             ## Tasklist: research
             AI framework comparison report

             - [x] fetch_sources ✓
               output: { frameworks: [{name:"PyTorch",...}, ...] (4) }
             - [x] fetch_benchmarks ✓
               output: { benchmarks: [{suite:"MLPerf",...}, ...] (3) }
             - [ ] analyze (ready)
               depends on: fetch_sources, fetch_benchmarks
             - [ ] write_report (pending)
               depends on: analyze
             - [ ] publish (pending, optional)
               depends on: write_report
               condition: write_report.words > 100
[assistant]  // Both fetches complete...\nconst comparison = ...\n
             completeTask("research", "analyze", ...)\n
             const report = ...\ncompleteTask("research", "write_report", ...)\n
             completeTask("research", "publish", ...)\n
             display(...)\n// Done!
```

Note how `completeTaskAsync` runs tasks concurrently without creating turn boundaries. The agent calls `sleep` to wait, then `stop()` to read results — only `stop` creates the turn boundary and injects the `{{TASKS}}` block. The DAG dependency graph ensures `analyze` cannot become ready until both `fetch_sources` and `fetch_benchmarks` complete, and `publish` is conditionally evaluated only after `write_report` finishes.

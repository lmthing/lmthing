/**
 * Basic benchmark scenarios — one global per scenario, deterministic known answers.
 *
 * Each scenario's systemPromptDoc is taken verbatim from buildSystemPrompt.ts
 * (the ### heading block for that global). This tests the actual documentation
 * quality rather than simplified descriptions.
 */

import type { BenchScenario, MockGlobals } from '../types'
import type { Sandbox } from '../../sandbox/sandbox'

const PREAMBLE = `You are a TypeScript REPL agent. Write only valid TypeScript code — no prose, no markdown fences.
The sandbox has no imports. The following globals are available.`

function doc(text: string): string {
  return `${PREAMBLE}\n\n${text.trim()}`
}

// ── stop ─────────────────────────────────────────────────────────────────────

const stopDoc = doc(`
### await stop(...values) — Pause and read
Suspends your execution. The runtime evaluates each argument, serializes the results, and injects them as a user message prefixed with "← stop". You resume with knowledge of those values.

Use stop when you need to inspect a runtime value before deciding what to write next.
Example: await stop(x, y) → you will see: ← stop { x: <value>, y: <value> }

IMPORTANT: After calling await stop(), STOP writing code.
`)

export const stopFib: BenchScenario = {
  id: 'stop-fib',
  global: 'stop',
  difficulty: 'basic',
  systemPromptDoc: stopDoc,
  userPrompt: 'Write code that: (1) computes Fibonacci(10) — the result is 55; (2) stores it in variable "result"; (3) calls await stop(result).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const stopCalls = globals['stop']?.mock.calls
    if (!stopCalls?.length) return false
    return stopCalls[0][0] === 55
  },
  expectedDescription: 'stop() called with value 55',
}

// ── display ───────────────────────────────────────────────────────────────────

const displayDoc = doc(`
### display(element) — Show output to user
Non-blocking. Appends a rendered component to the user's view. Use with display components only.
Example: display(<RecipeCard name="Pasta" cuisine="Italian" ... />)
Or plain objects: display({ type: 'div', props: { children: 'Hello' } })
`)

export const displayCall: BenchScenario = {
  id: 'display-call',
  global: 'display',
  difficulty: 'basic',
  systemPromptDoc: displayDoc,
  userPrompt: 'Write a single line that calls display() with a plain object: { type: "p", props: { children: "Hello World" } }.',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    return (globals['display']?.mock.calls.length ?? 0) > 0
  },
  expectedDescription: 'display() called with an object argument',
}

// ── ask ──────────────────────────────────────────────────────────────────────

const askDoc = doc(`
### var data = await ask(element) — Collect user input
Blocking. Renders a form to the user and waits for submission. The host wraps your element in a \`<form>\` with Submit/Cancel buttons — do NOT add your own \`<form>\` tag.
Each input component must have a \`name\` attribute. The returned object maps name → submitted value.

IMPORTANT: Do NOT wrap ask() content in \`<form>\`. Always call await stop() right after ask() to see the values.

Example:
var prefs = await ask(<div>
  <Select name="cuisine" label="Pick cuisine" options={["italian", "japanese"]} />
  <TextInput name="notes" label="Any notes?" />
</div>)
await stop(prefs)
`)

export const askCall: BenchScenario = {
  id: 'ask-call',
  global: 'ask',
  difficulty: 'basic',
  systemPromptDoc: askDoc,
  userPrompt: 'Write code that: (1) calls await ask() with a plain object { type: "div", props: { children: [{ type: "input", props: { name: "email", type: "text" } }] } }; (2) stores the result in "input"; (3) calls await stop(input).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const askCalls = globals['ask']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!askCalls?.length || !stopCalls?.length) return false
    const askArg = askCalls[0][0]
    return typeof askArg === 'object' && askArg !== null && 'type' in askArg
  },
  expectedDescription: 'ask() called with a div object containing an input with name="email"',
}

// ── sleep ─────────────────────────────────────────────────────────────────────

const sleepDoc = doc(`
### await sleep(seconds) — Pause execution
Pauses sandbox execution (not the LLM stream). Async tasks continue during sleep.

Example:
await sleep(5)
await stop()
`)

export const sleepCall: BenchScenario = {
  id: 'sleep-call',
  global: 'sleep',
  difficulty: 'basic',
  systemPromptDoc: sleepDoc,
  userPrompt: 'Write a single line that calls await sleep(0.01).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['sleep']?.mock.calls
    if (!calls?.length) return false
    const secs = calls[0][0] as number
    return typeof secs === 'number' && secs >= 0 && secs <= 1
  },
  expectedDescription: 'sleep() called with a small positive number',
}

// ── tasklist + completeTask ───────────────────────────────────────────────────

const tasklistDoc = doc(`
### tasklist(tasklistId, description, tasks) — Declare a task plan with milestones
Before starting any implementation work, declare a plan using tasklist(). This registers milestones with the host under a unique tasklistId. Each task has an id, instructions, and outputSchema describing the result shape.

Example:
tasklist("analyze_data", "Analyze employee data", [
  { id: "load", instructions: "Load the dataset", outputSchema: { count: { type: "number" } } },
  { id: "analyze", instructions: "Compute statistics", outputSchema: { done: { type: "boolean" } }, dependsOn: ["load"] },
])

### completeTask(tasklistId, taskId, output) — Mark a milestone as complete
When you reach a milestone, call completeTask() with the tasklist ID, task ID, and an output object matching the declared outputSchema. Non-blocking.

Example:
completeTask("analyze_data", "load", { count: 10 })
`)

export const tasklistComplete: BenchScenario = {
  id: 'tasklist-complete',
  global: ['tasklist', 'completeTask'],
  difficulty: 'basic',
  systemPromptDoc: tasklistDoc,
  userPrompt: 'Write code that: (1) declares a tasklist "wf" with description "Process data" and two sequential tasks: "fetch" (outputSchema: {data:{type:"string"}}) and "save" (outputSchema: {id:{type:"number"}}); (2) completes "fetch" with {data:"hello"}; (3) completes "save" with {id:1}.',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const tlCalls = globals['tasklist']?.mock.calls
    const ctCalls = globals['completeTask']?.mock.calls
    if (!tlCalls?.length || !ctCalls || ctCalls.length < 2) return false
    const [tlId, , tasks] = tlCalls[0] as [string, string, Array<{id:string}>]
    if (tlId !== 'wf') return false
    if (!Array.isArray(tasks) || tasks.length !== 2) return false
    const completedIds = ctCalls.map((c) => c[1] as string)
    return completedIds.includes('fetch') && completedIds.includes('save')
  },
  expectedDescription: 'tasklist declared with 2 tasks, both completed',
}

// ── pipeline ──────────────────────────────────────────────────────────────────

const pipelineDoc = doc(`
### await pipeline(data, ...transforms) — Chained data transformations
Passes data through a sequence of named transforms. Each receives the output of the previous one. Supports async transforms. Returns { result, steps: [{ name, durationMs, ok, error? }] }.

Example:
var output = await pipeline(rawData,
  { name: "parse", fn: (d) => JSON.parse(d) },
  { name: "filter", fn: (arr) => arr.filter(x => x.active) },
)
`)

export const pipelineSum: BenchScenario = {
  id: 'pipeline-sum',
  global: 'pipeline',
  difficulty: 'basic',
  systemPromptDoc: pipelineDoc,
  userPrompt: 'Write code that pipes the array [1,2,3] through a "sum" transform (reduces to sum) and stores the result in variable "out".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['pipeline']?.mock.calls
    if (!calls?.length) return false
    const [data, ...transforms] = calls[0] as [unknown, ...Array<{name:string; fn:unknown}>]
    if (!Array.isArray(data) || data.length !== 3) return false
    if (!transforms.length) return false
    return transforms[0].name === 'sum' && typeof transforms[0].fn === 'function'
  },
  expectedDescription: 'pipeline called with [1,2,3] and a "sum" transform',
}

// ── parallel ──────────────────────────────────────────────────────────────────

const parallelDoc = doc(`
### await parallel(tasks, options?) — Concurrent fan-out/fan-in
Run multiple async functions concurrently and collect all results. Each task has a label and an fn. Returns an array of { label, ok, result?, error?, durationMs }. Max 10 tasks.

Example:
var results = await parallel([
  { label: "users", fn: () => fetchUsers() },
  { label: "orders", fn: () => fetchOrders() },
], { timeout: 10000 })
`)

export const parallelConstants: BenchScenario = {
  id: 'parallel-constants',
  global: 'parallel',
  difficulty: 'basic',
  systemPromptDoc: parallelDoc,
  userPrompt: 'Write code that runs two parallel tasks: "task-a" returns 1, "task-b" returns 2. Store results in "results".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['parallel']?.mock.calls
    if (!calls?.length) return false
    const [tasks] = calls[0] as [Array<{label:string; fn:unknown}>]
    if (!Array.isArray(tasks) || tasks.length < 2) return false
    const labels = tasks.map(t => t.label)
    return labels.includes('task-a') && labels.includes('task-b')
  },
  expectedDescription: 'parallel called with 2 tasks: task-a and task-b',
}

// ── guard ─────────────────────────────────────────────────────────────────────

const guardDoc = doc(`
### guard(condition, message) — Runtime assertion
Throws a GuardError if condition is falsy. Use to validate assumptions before proceeding.

Example:
guard(users.length > 0, "No users found — query may be wrong")
guard(typeof result.id === "string", "Expected string ID, got " + typeof result.id)
`)

export const guardPass: BenchScenario = {
  id: 'guard-pass',
  global: 'guard',
  difficulty: 'basic',
  systemPromptDoc: guardDoc,
  userPrompt: 'Write code that: (1) declares const items = [1, 2, 3]; (2) uses guard to assert items.length > 0 with message "items must not be empty".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['guard']?.mock.calls
    if (!calls?.length) return false
    const [condition, message] = calls[0] as [unknown, string]
    return Boolean(condition) && typeof message === 'string' && message.toLowerCase().includes('empty')
  },
  expectedDescription: 'guard called with truthy condition and message containing "empty"',
}

// ── schema ────────────────────────────────────────────────────────────────────

const schemaDoc = doc(`
### schema(value) — Infer JSON schema from a runtime value
Analyzes a runtime value and returns its JSON schema (type, properties, items, required). Use to understand data shapes.
`)

export const schemaInfer: BenchScenario = {
  id: 'schema-infer',
  global: 'schema',
  difficulty: 'basic',
  systemPromptDoc: schemaDoc,
  userPrompt: 'Write a single line that infers the schema of the object { count: 5 } and stores it in variable "s".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['schema']?.mock.calls
    if (!calls?.length) return false
    const arg = calls[0][0] as Record<string, unknown>
    return typeof arg === 'object' && arg !== null && (arg as any).count === 5
  },
  expectedDescription: 'schema() called with { count: 5 }',
}

// ── validate ──────────────────────────────────────────────────────────────────

const validateDoc = doc(`
### validate(value, schema) — Validate against a schema
Checks a value against a JSON-like schema. Returns { valid: true } or { valid: false, errors: ["..."] }.

Example:
var check = validate(otherData, s)
`)

export const validateNumber: BenchScenario = {
  id: 'validate-number',
  global: 'validate',
  difficulty: 'basic',
  systemPromptDoc: validateDoc,
  userPrompt: 'Write a single line that validates the number 99 against { type: "number" } and stores the result in "result".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['validate']?.mock.calls
    if (!calls?.length) return false
    const [val, sch] = calls[0] as [unknown, Record<string, unknown>]
    return val === 99 && typeof sch === 'object' && sch?.type === 'number'
  },
  expectedDescription: 'validate() called with (99, { type: "number" })',
}

// ── broadcast + listen ────────────────────────────────────────────────────────

const broadcastListenDoc = doc(`
### broadcast(channel, data) — Emit event on a named channel
Publishes data to a named channel. Events are buffered (last 10 per channel).

### listen(channel, callback?) — Subscribe to a channel
If no callback, returns and clears the buffered events array.

Example:
broadcast("data_ready", { source: "api", count: 42 })
var events = listen("data_ready")
await stop(events)
`)

export const broadcastListen: BenchScenario = {
  id: 'broadcast-listen',
  global: ['broadcast', 'listen'],
  difficulty: 'basic',
  systemPromptDoc: broadcastListenDoc,
  userPrompt: 'Write code that: (1) broadcasts a "done" event on channel "results" with value { ok: true }; (2) retrieves buffered events from "results" into variable "events".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const bcCalls = globals['broadcast']?.mock.calls
    const liCalls = globals['listen']?.mock.calls
    if (!bcCalls?.length || !liCalls?.length) return false
    return bcCalls[0][0] === 'results' && liCalls[0][0] === 'results'
  },
  expectedDescription: 'broadcast and listen both called with channel "results"',
}

// ── pin + unpin ───────────────────────────────────────────────────────────────

const pinUnpinDoc = doc(`
### pin(key, value) — Pin a value to persistent memory
Saves a value that survives stop-payload decay indefinitely. Max 10 pins.

Example:
pin("userSchema", { id: "uuid", name: "string", email: "string" })

### unpin(key) — Remove a pinned value
Frees a pin slot when the value is no longer needed.

Example:
unpin("userSchema")
`)

export const pinUnpin: BenchScenario = {
  id: 'pin-unpin',
  global: ['pin', 'unpin'],
  difficulty: 'basic',
  systemPromptDoc: pinUnpinDoc,
  userPrompt: 'Write code that: (1) pins the key "sessionId" with value "s_42"; (2) then unpins "sessionId".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const pinCalls = globals['pin']?.mock.calls
    const unpinCalls = globals['unpin']?.mock.calls
    if (!pinCalls?.length || !unpinCalls?.length) return false
    const [pinKey, pinVal] = pinCalls[0] as [string, string]
    const [unpinKey] = unpinCalls[0] as [string]
    return pinKey === 'sessionId' && pinVal === 's_42' && unpinKey === 'sessionId'
  },
  expectedDescription: 'pin("sessionId","s_42") then unpin("sessionId")',
}

// ── memo ──────────────────────────────────────────────────────────────────────

const memoDoc = doc(`
### memo(key, value?) — Compressed semantic memory
Write: memo("data-shape", "Users table: 12 cols...")
Read:  var note = memo("data-shape") → returns the string or undefined
Delete: memo("data-shape", null)

Max 20 memos. Memos never decay.
`)

export const memoWriteRead: BenchScenario = {
  id: 'memo-write-read',
  global: 'memo',
  difficulty: 'basic',
  systemPromptDoc: memoDoc,
  userPrompt: 'Write code that: (1) writes a memo with key "progress" and value "halfway done"; (2) reads it back into variable "note".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['memo']?.mock.calls
    if (!calls || calls.length < 2) return false
    const writeCall = calls[0] as [string, string]
    const readCall = calls[1] as [string]
    return writeCall[0] === 'progress' && writeCall[1] === 'halfway done' && readCall[0] === 'progress'
  },
  expectedDescription: 'memo("progress","halfway done") then memo("progress")',
}

// ── checkpoint + rollback (wired) ─────────────────────────────────────────────

const checkpointDoc = doc(`
### checkpoint(id) — Save sandbox state snapshot
Saves a named snapshot of all current variable values. Max 5 checkpoints.

Example:
checkpoint("before_transform")
var result = await riskyTransform(data)
// If result.success is false:
rollback("before_transform")

### rollback(id) — Restore sandbox state from checkpoint
Restores all variables to the values they had when checkpoint(id) was created.
Variables created after the checkpoint are removed.
`)

export const checkpointRollback: BenchScenario = {
  id: 'checkpoint-rollback',
  global: ['checkpoint', 'rollback'],
  difficulty: 'basic',
  systemPromptDoc: checkpointDoc,
  userPrompt: 'Write code that: (1) declares var x = 1; (2) calls checkpoint("snap"); (3) sets x = 99; (4) calls rollback("snap"); (5) calls await stop(x).',
  needsWiredCheckpoint: true,
  verify: (sb: Sandbox, globals: MockGlobals) => {
    // With wired checkpoint, rollback restores x=1
    const stopCalls = globals['stop']?.mock.calls
    if (!stopCalls?.length) return false
    return stopCalls[0][0] === 1
  },
  expectedDescription: 'after checkpoint("snap") + mutate + rollback("snap"), stop called with original value 1',
}

// ── contextBudget ─────────────────────────────────────────────────────────────

const contextBudgetDoc = doc(`
### contextBudget() — Check context window usage
Returns: { totalTokens, usedTokens, remainingTokens, recommendation: 'nominal'|'conserve'|'critical' }

Example:
var budget = contextBudget()
if (budget.recommendation === 'critical') { /* trim context */ }
`)

export const contextBudgetConserve: BenchScenario = {
  id: 'contextBudget-conserve',
  global: 'contextBudget',
  difficulty: 'basic',
  systemPromptDoc: contextBudgetDoc,
  userPrompt: 'Write code that: (1) reads context budget into "budget"; (2) sets variable "shouldTrim" to true if recommendation is "conserve" or "critical", false otherwise.',
  verify: (sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['contextBudget']?.mock.calls
    if (!calls?.length) return false
    const shouldTrim = sb.getValue('shouldTrim')
    return shouldTrim === true // mock returns 'conserve'
  },
  expectedDescription: 'contextBudget() called, shouldTrim is true for "conserve" recommendation',
}

// ── focus ─────────────────────────────────────────────────────────────────────

const focusDoc = doc(`
### focus(...sections) — Control prompt section expansion
Sections: 'functions', 'knowledge', 'components', 'classes', 'agents'. Call focus('all') to restore full expansion.

Example:
focus("functions", "knowledge")  // expand only these, collapse others
focus("all")                     // restore everything
`)

export const focusSections: BenchScenario = {
  id: 'focus-sections',
  global: 'focus',
  difficulty: 'basic',
  systemPromptDoc: focusDoc,
  userPrompt: 'Write a single line that focuses only on the "knowledge" and "functions" sections of the system prompt.',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['focus']?.mock.calls
    if (!calls?.length) return false
    const sections = calls[0] as string[]
    return sections.includes('knowledge') && sections.includes('functions')
  },
  expectedDescription: 'focus() called with "knowledge" and "functions"',
}

// ── async ─────────────────────────────────────────────────────────────────────

const asyncGlobalDoc = doc(`
### async(fn, label?) — Fire-and-forget background task
Does not block execution. fn: async () => void. label: optional description shown in UI.
Results are delivered at the next stop() call.

Example:
async(async () => { await someWork() }, 'doing work')
`)

export const asyncLabel: BenchScenario = {
  id: 'async-label',
  global: 'async',
  difficulty: 'basic',
  systemPromptDoc: asyncGlobalDoc,
  userPrompt: 'Write a single line that starts a background task labeled "send-report" that calls an async function sendReport() (assume it exists).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['async']?.mock.calls
    if (!calls?.length) return false
    const [fn, label] = calls[0] as [unknown, string | undefined]
    return typeof fn === 'function' && (label === undefined || typeof label === 'string')
  },
  expectedDescription: 'async() called with a function argument',
}

// ── completeTaskAsync ───────────────────────────────────────────────────────────

const completeTaskAsyncDoc = doc(`
### completeTaskAsync(tasklistId, taskId, fn) — Complete a task in the background
Launches task work as a background async function. The function's return value becomes the task output. Results are delivered via the next stop() call with task:<taskId> keys. Non-blocking.

Example:
completeTaskAsync("data", "fetch_api", async () => {
  var res = await fetchFromAPI()
  return { count: res.length }
})
`)

export const completeTaskAsyncCall: BenchScenario = {
  id: 'complete-task-async-call',
  global: 'completeTaskAsync',
  difficulty: 'basic',
  systemPromptDoc: completeTaskAsyncDoc,
  userPrompt: 'Write code that: (1) declares a tasklist "api" with description "Fetch data" and one task "fetch" (outputSchema: {count:{type:"number"}}); (2) calls completeTaskAsync("api","fetch",async()=>{return{count:42}}).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const tlCalls = globals['tasklist']?.mock.calls
    const ctaCalls = globals['completeTaskAsync']?.mock.calls
    if (!tlCalls?.length || !ctaCalls?.length) return false
    const [tlId] = ctaCalls[0] as [string, string, unknown]
    const [taskId] = ctaCalls[0] as [string, string, unknown]
    return tlId === 'api' && taskId === 'fetch'
  },
  expectedDescription: 'tasklist declared, completeTaskAsync called with tasklist "api" and task "fetch"',
}

// ── taskProgress ────────────────────────────────────────────────────────────────

const taskProgressDoc = doc(`
### taskProgress(tasklistId, taskId, message, percent?) — Report task progress
Reports incremental progress within a running task. Non-blocking, synchronous.

Example:
taskProgress("data", "fetch_api", "Downloading...", 50)
`)

export const taskProgressCall: BenchScenario = {
  id: 'task-progress-call',
  global: 'taskProgress',
  difficulty: 'basic',
  systemPromptDoc: taskProgressDoc,
  userPrompt: 'Write a single line that reports 50% progress for task "process" in tasklist "work" with message "Processing...".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['taskProgress']?.mock.calls
    if (!calls?.length) return false
    const [tlId, taskId, msg, percent] = calls[0] as [string, string, string, number]
    return tlId === 'work' && taskId === 'process' && typeof msg === 'string' && percent === 50
  },
  expectedDescription: 'taskProgress called with tasklist "work", task "process", message, and 50 percent',
}

// ── loadKnowledge ───────────────────────────────────────────────────────────────

const loadKnowledgeDoc = doc(`
### loadKnowledge(selector) — Load knowledge files from spaces
Loads markdown content from the knowledge base. Pass a selector object that mirrors the knowledge tree structure, setting \`true\` on the specific files you want to load.

Example:
var docs = loadKnowledge({
  "my-space": {
    "chat-modes": {
      "mode": {
        "casual": true
      }
    }
  }
})
`)

export const loadKnowledgeCall: BenchScenario = {
  id: 'load-knowledge-call',
  global: 'loadKnowledge',
  difficulty: 'basic',
  systemPromptDoc: loadKnowledgeDoc,
  userPrompt: 'Write a single line that loads knowledge from space "docs" domain "guide" field "intro" option "start" and stores it in variable "guide".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['loadKnowledge']?.mock.calls
    if (!calls?.length) return false
    const selector = calls[0][0] as Record<string, unknown>
    const docs = selector['docs'] as Record<string, unknown>
    const guide = docs?.['guide'] as Record<string, unknown>
    return guide && 'intro' in guide
  },
  expectedDescription: 'loadKnowledge called with selector for docs.guide.intro.start',
}

// ── compress ───────────────────────────────────────────────────────────────────

const compressDoc = doc(`
### await compress(data, options?) — LLM-powered data compression
Compresses large data into a token-efficient summary before it enters your context. Use proactively on large API responses or file contents. Options: preserveKeys (keep exact), maxTokens (target ~200), format ("structured"|"prose").

Example:
var summary = await compress(largeApiResponse, { preserveKeys: ["id", "status"], maxTokens: 150 })
`)

export const compressCall: BenchScenario = {
  id: 'compress-call',
  global: 'compress',
  difficulty: 'basic',
  systemPromptDoc: compressDoc,
  userPrompt: 'Write code that: (1) declares var items = Array(100).fill({id:1,name:"item"}); (2) compresses items with options { preserveKeys: ["id"], maxTokens: 100 } into variable "summary".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['compress']?.mock.calls
    if (!calls?.length) return false
    const [data, opts] = calls[0] as [unknown, Record<string, unknown>]
    return Array.isArray(data) && opts?.maxTokens === 100
  },
  expectedDescription: 'compress called with array data and { maxTokens: 100, preserveKeys: ["id"] }',
}

// ── delegate ───────────────────────────────────────────────────────────────────

const delegateDoc = doc(`
### await delegate(task, options?) — Smart task routing
Routes a task to the best execution strategy. Pass a function for direct execution, or a string for LLM-powered reasoning (uses fork). Options: strategy ('auto'|'fork'|'parallel'|'direct'), timeout, context. Returns { strategy, result, durationMs }.

Example:
var r1 = await delegate(() => processData(rawData), { timeout: 5000 })
`)

export const delegateCall: BenchScenario = {
  id: 'delegate-call',
  global: 'delegate',
  difficulty: 'basic',
  systemPromptDoc: delegateDoc,
  userPrompt: 'Write code that delegates a function () => 42 with timeout 1000 and stores the result in variable "out".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['delegate']?.mock.calls
    if (!calls?.length) return false
    const [task, opts] = calls[0] as [unknown, Record<string, unknown>]
    return typeof task === 'function' && opts?.timeout === 1000
  },
  expectedDescription: 'delegate called with a function and { timeout: 1000 }',
}

// ── cachedFetch ────────────────────────────────────────────────────────────────

const cachedFetchDoc = doc(`
### await cachedFetch(url, options?) — HTTP fetch with caching and retry
Fetches a URL with built-in TTL caching, exponential backoff retry (default 2 retries), auto JSON/text parsing, and timeout. Returns { data, cached, status, durationMs }. Cache up to 50 entries.

Example:
var resp = await cachedFetch("https://api.example.com/data", { cacheTtlMs: 60000, maxRetries: 3, parseAs: "json" })
`)

export const cachedFetchCall: BenchScenario = {
  id: 'cached-fetch-call',
  global: 'cachedFetch',
  difficulty: 'basic',
  systemPromptDoc: cachedFetchDoc,
  userPrompt: 'Write a single line that fetches from "https://api.example.com/data" with cacheTtlMs of 60000 and stores the result in "response".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['cachedFetch']?.mock.calls
    if (!calls?.length) return false
    const [url, opts] = calls[0] as [string, Record<string, unknown> | undefined]
    return url === 'https://api.example.com/data' && opts?.cacheTtlMs === 60000
  },
  expectedDescription: 'cachedFetch called with URL and { cacheTtlMs: 60000 }',
}

// ── trace ──────────────────────────────────────────────────────────────────────

const traceDoc = doc(`
### trace() — Execution profiling snapshot
Returns a comprehensive profiling snapshot: turns, LLM calls, token usage (input/output/total), estimated cost, async task stats, scope size, pinned/memo counts, session duration. Use to monitor resource consumption.

Example:
var stats = trace()
`)

export const traceCall: BenchScenario = {
  id: 'trace-call',
  global: 'trace',
  difficulty: 'basic',
  systemPromptDoc: traceDoc,
  userPrompt: 'Write a single line that calls trace() and stores the result in variable "stats".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const calls = globals['trace']?.mock.calls
    return (calls?.length ?? 0) > 0
  },
  expectedDescription: 'trace() called and result stored in variable "stats"',
}

// ── knowledge.writer ────────────────────────────────────────────────────────────

const knowledgeWriterDoc = doc(`
### knowledge.writer({ field }) — Persist knowledge and memories
The \`knowledge\` namespace is always available. Use it to save, update, or delete knowledge entries on disk. The \`field\` parameter uses "domain/field" notation (e.g., \`"memory/project"\`, \`"cuisine/type"\`).

Examples:
knowledge.writer({ field: "memory/project" }).save("auth-flow", "Authentication uses SSO codes with 60s TTL.")
knowledge.writer({ field: "memory/feedback" }).remove("old-approach")
`)

export const knowledgeWriterSave: BenchScenario = {
  id: 'knowledge-writer-save',
  global: 'knowledge.writer',
  difficulty: 'basic',
  systemPromptDoc: knowledgeWriterDoc,
  userPrompt: 'Write a single line that uses knowledge.writer with field "memory/project" to save a memory with key "build-process" and value "Build uses pnpm and TypeScript".',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const writerCalls = globals['knowledge.writer']?.mock.calls
    if (!writerCalls?.length) return false
    const [config] = writerCalls[0] as [Record<string, unknown>]
    return config?.field === 'memory/project'
  },
  expectedDescription: 'knowledge.writer called with field "memory/project" and save method',
}

// ── export ────────────────────────────────────────────────────────────────────

export const BASIC_SCENARIOS: BenchScenario[] = [
  stopFib,
  displayCall,
  askCall,
  sleepCall,
  tasklistComplete,
  completeTaskAsyncCall,
  taskProgressCall,
  loadKnowledgeCall,
  pipelineSum,
  parallelConstants,
  guardPass,
  schemaInfer,
  validateNumber,
  broadcastListen,
  pinUnpin,
  memoWriteRead,
  checkpointRollback,
  contextBudgetConserve,
  focusSections,
  compressCall,
  delegateCall,
  cachedFetchCall,
  traceCall,
  knowledgeWriterSave,
  asyncLabel,
]

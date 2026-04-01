/**
 * Intermediate benchmark scenarios — 2-3 globals per scenario requiring coordination.
 */

import type { BenchScenario, MockGlobals } from '../types'
import type { Sandbox } from '../../sandbox/sandbox'

const PREAMBLE = `You are a TypeScript REPL agent. Write only valid TypeScript code — no prose, no markdown fences.
The sandbox has no imports. The following globals are available.`

function doc(text: string): string {
  return `${PREAMBLE}\n\n${text.trim()}`
}

// ── tasklist + display + stop ─────────────────────────────────────────────────

export const tasklistDisplayStop: BenchScenario = {
  id: 'tasklist-display-stop',
  global: ['tasklist', 'display', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### tasklist(tasklistId, description, tasks) — Declare a task plan
Register milestones. Each task: { id, instructions, outputSchema }.
completeTask(tasklistId, taskId, output) — Mark milestone complete.

### display(element) — Show output to user (non-blocking)
display({ type: "div", props: { children: "message" } })

### await stop(...values) — Pause and read values
STOP writing after calling stop(). await stop(val) → sees: ← stop { val: ... }
`),
  userPrompt: 'Write code that: (1) declares tasklist "report" with description "Generate report" and 2 tasks: "gather" (outputSchema: {done:{type:"boolean"}}) and "present" (outputSchema: {done:{type:"boolean"}}); (2) calls display() once with a plain object; (3) completeTask for both tasks; (4) calls await stop("done").',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const tlCalls = globals['tasklist']?.mock.calls
    const dispCalls = globals['display']?.mock.calls
    const ctCalls = globals['completeTask']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!tlCalls?.length) return false
    if (!dispCalls?.length) return false
    if (!ctCalls || ctCalls.length < 2) return false
    if (!stopCalls?.length) return false
    const completedIds = ctCalls.map((c: unknown[]) => c[1] as string)
    return completedIds.includes('gather') && completedIds.includes('present')
  },
  expectedDescription: 'tasklist declared, display called, both tasks completed, stop called',
}

// ── pipeline + guard + stop ───────────────────────────────────────────────────

export const pipelineGuardStop: BenchScenario = {
  id: 'pipeline-guard-stop',
  global: ['pipeline', 'guard', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await pipeline(data, ...transforms) — Chained data transformations
Returns { result, steps }. Each transform: { name: string, fn: (input) => output }.

### guard(condition, message) — Runtime assertion
Throws GuardError if falsy. guard(x > 0, "must be positive")

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) pipes number 10 through a "double" transform (multiplies by 2), storing result in "out"; (2) uses guard to assert out.result > 0 with message "result must be positive"; (3) calls await stop(out.result).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const pipeCalls = globals['pipeline']?.mock.calls
    const guardCalls = globals['guard']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!pipeCalls?.length || !guardCalls?.length || !stopCalls?.length) return false
    // pipeline was called with 10
    const [data] = pipeCalls[0] as [unknown]
    return data === 10
  },
  expectedDescription: 'pipeline called with 10, guard called, stop called with result',
}

// ── parallel + tasklist ───────────────────────────────────────────────────────

export const parallelWithTasklist: BenchScenario = {
  id: 'parallel-with-tasklist',
  global: ['parallel', 'tasklist', 'completeTask'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### tasklist(tasklistId, description, tasks) — Declare a task plan
tasks: Array<{ id, instructions, outputSchema }>. completeTask(id, taskId, output) marks complete.

### await parallel(tasks, options?) — Concurrent fan-out/fan-in
Each task: { label: string, fn: () => unknown }. Returns Array<{ label, ok, result?, durationMs }>.

### completeTask(tasklistId, taskId, output) — Mark milestone complete
`),
  userPrompt: 'Write code that: (1) declares tasklist "work" with description "Parallel work" and one task "fetch-all" (outputSchema: {count:{type:"number"}}); (2) runs parallel with 3 tasks labeled "fetch-a", "fetch-b", "fetch-c" each returning a number, storing in "results"; (3) completes "fetch-all" with {count: 3}.',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const tlCalls = globals['tasklist']?.mock.calls
    const parallelCalls = globals['parallel']?.mock.calls
    const ctCalls = globals['completeTask']?.mock.calls
    if (!tlCalls?.length || !parallelCalls?.length || !ctCalls?.length) return false
    const [tasks] = parallelCalls[0] as [Array<{label:string}>]
    return Array.isArray(tasks) && tasks.length === 3
  },
  expectedDescription: 'tasklist declared, parallel run with 3 tasks, completeTask called',
}

// ── speculate + stop ──────────────────────────────────────────────────────────

export const speculatePickWinner: BenchScenario = {
  id: 'speculate-pick-winner',
  global: ['speculate', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await speculate(branches, options?) — Parallel hypothesis testing
Run multiple approaches concurrently. branches: Array<{ label: string, fn: () => unknown }>.
Max 5 branches. Returns { results: Array<{ label, ok, result?, error?, durationMs }> }.

Example:
var trial = await speculate([
  { label: "regex", fn: () => data.match(/pattern/g)?.length ?? 0 },
  { label: "split", fn: () => data.split("delimiter").length - 1 },
])
await stop(trial)

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) runs speculate with 2 branches: "approach-a" returns 42, "approach-b" returns 0; stores in "trial"; (2) finds the winning branch (ok && result > 0) and stores its label in "winner"; (3) calls await stop(winner).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const specCalls = globals['speculate']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!specCalls?.length || !stopCalls?.length) return false
    const [branches] = specCalls[0] as [Array<{label:string; fn:unknown}>]
    if (!Array.isArray(branches) || branches.length !== 2) return false
    const labels = branches.map(b => b.label)
    return labels.includes('approach-a') && labels.includes('approach-b')
  },
  expectedDescription: 'speculate called with 2 branches, stop called with winning label',
}

// ── pin + memo + contextBudget ────────────────────────────────────────────────

export const pinMemoContextBudget: BenchScenario = {
  id: 'pin-memo-contextBudget',
  global: ['pin', 'memo', 'contextBudget', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### pin(key, value) — Pin a value to persistent memory (survives decay, max 10)
### memo(key, value?) — Compressed semantic memory (write/read/delete)
### contextBudget() — Returns { totalTokens, usedTokens, remainingTokens, recommendation }
### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) pins "userId" with value "u_42"; (2) writes memo "status" with value "in progress"; (3) reads contextBudget into "budget"; (4) calls await stop(budget.recommendation).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const pinCalls = globals['pin']?.mock.calls
    const memoCalls = globals['memo']?.mock.calls
    const budgetCalls = globals['contextBudget']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!pinCalls?.length || !memoCalls?.length || !budgetCalls?.length || !stopCalls?.length) return false
    const [pinKey] = pinCalls[0] as [string]
    return pinKey === 'userId'
  },
  expectedDescription: 'pin, memo, contextBudget, stop all called in sequence',
}

// ── retryTask + failTask ──────────────────────────────────────────────────────

export const retryTaskFailTask: BenchScenario = {
  id: 'retryTask-failTask',
  global: ['tasklist', 'failTask', 'retryTask', 'completeTask'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### tasklist(tasklistId, description, tasks) — Declare a task plan
### failTask(tasklistId, taskId, error) — Mark a task as failed
### retryTask(tasklistId, taskId) — Retry a failed task (max 3 retries)
### completeTask(tasklistId, taskId, output) — Mark a milestone as complete

Example:
tasklist("work", "Process items", [
  { id: "step1", instructions: "Try step 1", outputSchema: { done: { type: "boolean" } } },
])
failTask("work", "step1", "initial failure")
retryTask("work", "step1")
completeTask("work", "step1", { done: true })
`),
  userPrompt: 'Write code that: (1) declares tasklist "recovery" with description "Recovery test" and one task "step1" (outputSchema: {done:{type:"boolean"}}); (2) calls failTask("recovery","step1","simulated error"); (3) calls retryTask("recovery","step1"); (4) calls completeTask("recovery","step1",{done:true}).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const tlCalls = globals['tasklist']?.mock.calls
    const failCalls = globals['failTask']?.mock.calls
    const retryCalls = globals['retryTask']?.mock.calls
    const ctCalls = globals['completeTask']?.mock.calls
    if (!tlCalls?.length || !failCalls?.length || !retryCalls?.length || !ctCalls?.length) return false
    const [ftId, ftTask] = failCalls[0] as [string, string]
    const [rtId, rtTask] = retryCalls[0] as [string, string]
    return ftTask === 'step1' && rtTask === 'step1' && ftId === 'recovery' && rtId === 'recovery'
  },
  expectedDescription: 'fail + retry + complete cycle for step1 in "recovery" tasklist',
}

// ── fork + stop ────────────────────────────────────────────────────────────────

export const forkSubAgent: BenchScenario = {
  id: 'fork-sub-agent',
  global: ['fork', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await fork({ task, context?, outputSchema?, maxTurns? }) — Lightweight sub-agent
Runs a focused sub-reasoning task in an isolated context. The child's full reasoning stays separate — only the final JSON output enters your context. Use for complex analysis that would pollute your main conversation. Default 3 turns.

Example:
var analysis = await fork({
  task: "Analyze this error trace and identify the root cause",
  context: { errorTrace: traceStr },
  outputSchema: { rootCause: { type: "string" }, fix: { type: "string" } }
})

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) calls fork with task "Summarize this data", context { data: "sample data" }, and outputSchema { summary: { type: "string" } }; stores in "analysis"; (2) calls await stop(analysis).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const forkCalls = globals['fork']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!forkCalls?.length || !stopCalls?.length) return false
    const [config] = forkCalls[0] as [Record<string, unknown>]
    return config?.task === 'Summarize this data'
  },
  expectedDescription: 'fork called with task, context, and outputSchema; stop called',
}

// ── reflect + stop ─────────────────────────────────────────────────────────────

export const reflectSelfEval: BenchScenario = {
  id: 'reflect-self-eval',
  global: ['reflect', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await reflect({ question, context?, criteria? }) — Self-evaluation
Triggers a separate LLM call to evaluate your current approach. Returns { assessment, scores, suggestions, shouldPivot }. Use when uncertain about correctness, efficiency, or when stuck.

Example:
var review = await reflect({
  question: "Is my approach correct?",
  criteria: ["correctness", "efficiency"]
})

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) calls reflect with question "Is this correct?" and criteria ["accuracy"]; stores in "review"; (2) calls await stop(review).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const reflectCalls = globals['reflect']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!reflectCalls?.length || !stopCalls?.length) return false
    const [config] = reflectCalls[0] as [Record<string, unknown>]
    return config?.question === 'Is this correct?'
  },
  expectedDescription: 'reflect called with question and criteria; stop called',
}

// ── watch + stop ───────────────────────────────────────────────────────────────

export const watchReactive: BenchScenario = {
  id: 'watch-reactive',
  global: ['watch', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### watch(variableName, callback) — Reactive variable observation
Registers a callback that fires when a sandbox variable's value changes between stop() calls. Returns an unwatch function. The callback receives (newValue, oldValue).

Example:
var unwatch = watch("userCount", (newVal, oldVal) => {
  broadcast("count_changed", { from: oldVal, to: newVal })
})

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) declares var counter = 0; (2) watches "counter" with a callback that broadcasts to "counter_changed" channel; stores unwatch function; (3) sets counter = 5; (4) calls await stop(counter).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const watchCalls = globals['watch']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!watchCalls?.length || !stopCalls?.length) return false
    const [varName, callback] = watchCalls[0] as [string, unknown]
    return varName === 'counter' && typeof callback === 'function'
  },
  expectedDescription: 'watch registered on "counter" variable, stop called',
}

// ── learn + stop ───────────────────────────────────────────────────────────────

export const learnMemory: BenchScenario = {
  id: 'learn-memory',
  global: ['learn', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await learn(topic, insight, tags?) — Cross-session persistent memory
Persists a learning to the knowledge base's memory domain so it's available in future sessions. Topic becomes the file name (slugified), insight is the markdown content. Optional tags for categorization.

Example:
await learn("user prefers dark themes", "The user consistently requests dark color schemes.", ["preferences", "ui"])

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) calls await learn with topic "user preference", insight "User likes dark mode", and tags ["ui", "theme"]; (2) calls await stop("learned").',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const learnCalls = globals['learn']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!learnCalls?.length || !stopCalls?.length) return false
    const [topic, insight, tags] = learnCalls[0] as [string, string, string[] | undefined]
    return topic === 'user preference' && Array.isArray(tags) && tags.includes('ui')
  },
  expectedDescription: 'learn called with topic, insight, and tags array; stop called',
}

// ── critique + stop ────────────────────────────────────────────────────────────

export const critiqueQuality: BenchScenario = {
  id: 'critique-quality',
  global: ['critique', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await critique(output, criteria, context?) — Output quality gate
Evaluates output against criteria via a separate LLM call. Returns { pass, overallScore (0-1), scores (per criterion), issues, suggestions }. Pass threshold is 0.7.

Example:
var review = await critique(report, ["accuracy", "completeness"], "This is a sales report")

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) declares var result = "Analysis complete"; (2) calls await critique with result, criteria ["accuracy", "clarity"], and context "Quality check"; stores in "review"; (3) calls await stop(review).',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const critiqueCalls = globals['critique']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!critiqueCalls?.length || !stopCalls?.length) return false
    const [output, criteria, context] = critiqueCalls[0] as [unknown, string[], string | undefined]
    return Array.isArray(criteria) && criteria.includes('accuracy')
  },
  expectedDescription: 'critique called with output, criteria array, and context; stop called',
}

// ── plan + tasklist ────────────────────────────────────────────────────────────

export const planDecomposition: BenchScenario = {
  id: 'plan-decomposition',
  global: ['plan', 'tasklist', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### await plan(goal, constraints?) — LLM-powered task decomposition
Generates a structured task plan from a natural language goal via a separate LLM call. Returns an array of { id, instructions, dependsOn? }. Use the result to feed into tasklist() for execution.

Example:
var tasks = await plan("Build a data dashboard", ["use Chart.js"])

### tasklist(tasklistId, description, tasks) — Declare a task plan
### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) calls await plan with goal "Process data file" and constraints ["use csv"]; stores in "tasks"; (2) declares tasklist "data-pipeline" using tasks.map with outputSchema { done: { type: "boolean" } }; (3) calls await stop("planned").',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const planCalls = globals['plan']?.mock.calls
    const tlCalls = globals['tasklist']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!planCalls?.length || !tlCalls?.length || !stopCalls?.length) return false
    const [goal, constraints] = planCalls[0] as [string, string[] | undefined]
    return goal === 'Process data file' && Array.isArray(constraints)
  },
  expectedDescription: 'plan called with goal and constraints, tasklist declared using result, stop called',
}

// ── respond ────────────────────────────────────────────────────────────────────

export const respondToAgent: BenchScenario = {
  id: 'respond-to-agent',
  global: ['respond', 'stop'],
  difficulty: 'intermediate',
  systemPromptDoc: doc(`
### respond(agentPromise, data) — Answer a child agent's question
When a tracked spawned agent calls askParent(), it pauses and surfaces a question in {{AGENTS}}.
Call respond() with the agent's variable and a data object matching the question's schema.

Example:
respond(steakInstructions, {
  doneness: "medium-rare",
  thickness_cm: 3,
})

The child resumes execution with the data as the return value of its askParent() call.

### await stop(...values) — Pause and read values
`),
  userPrompt: 'Write code that: (1) assumes an agent variable "helper" exists and has asked a question; (2) calls respond(helper, { answer: "42", unit: "items" }); (3) calls await stop("responded").',
  verify: (_sb: Sandbox, globals: MockGlobals) => {
    const respondCalls = globals['respond']?.mock.calls
    const stopCalls = globals['stop']?.mock.calls
    if (!respondCalls?.length || !stopCalls?.length) return false
    const [agentVar, data] = respondCalls[0] as [unknown, Record<string, unknown>]
    return typeof data === 'object' && data !== null && 'answer' in data
  },
  expectedDescription: 'respond called with agent variable and data object, stop called',
}

// ── export ────────────────────────────────────────────────────────────────────

export const INTERMEDIATE_SCENARIOS: BenchScenario[] = [
  tasklistDisplayStop,
  pipelineGuardStop,
  parallelWithTasklist,
  speculatePickWinner,
  pinMemoContextBudget,
  retryTaskFailTask,
  forkSubAgent,
  reflectSelfEval,
  watchReactive,
  learnMemory,
  critiqueQuality,
  planDecomposition,
  respondToAgent,
]

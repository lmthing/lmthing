/**
 * Globals section — all global function documentation.
 *
 * This contains the ~400 lines of documentation for stop, display, ask,
 * tasklist, etc. Extracted from the monolithic buildSystemPrompt function.
 */

import type { SystemPromptConfig } from '../config';
import type { FocusController } from '../focus';

// Global documentation constants - extracted for maintainability
const STOP_DOCS = `### await stop(...values) — Pause and read
Suspends your execution. The runtime evaluates each argument, serializes the results, and injects them as a user message prefixed with "← stop". You resume with knowledge of those values.

Use stop when you need to inspect a runtime value before deciding what to write next.
Example: await stop(x, y) → you will see: ← stop { x: <value>, y: <value> }

Retention hints: Include a _retain key to control how fast the stop payload decays.
await stop(schema, _retain = "high")  // keeps values at full fidelity 2x longer
await stop(debugLog, _retain = "low") // decays values 2x faster than normal

IMPORTANT: After calling await stop(), STOP writing code. The runtime will pause your stream, read the values, and resume you in a new turn. Do NOT predict or simulate the stop response yourself.`;

const DISPLAY_DOCS = `### display(element) — Show output to user
Non-blocking. Appends a rendered component to the user's view. Use with display components only.
Example: display(<RecipeCard name="Pasta" cuisine="Italian" ... />)`;

const ASK_DOCS = `### var data = await ask(element) — Collect user input
Blocking. Renders a form to the user and waits for submission. The host wraps your element in a \`<form>\` with Submit/Cancel buttons — do NOT add your own \`<form>\` tag.
Each input component must have a \`name\` attribute. The returned object maps name → submitted value.

ask() resumes silently — no message is injected into the conversation. You MUST call stop() after ask() to read the submitted values.

Pattern:
var input = await ask(<RequestForm />)
await stop(input)
// ← stop { input: { request: "...", dietary: "..." } }

Multiple inputs:
var prefs = await ask(<div>
  <Select name="cuisine" label="Pick cuisine" options={["italian", "japanese"]} />
  <TextInput name="notes" label="Any notes?" />
</div>)
await stop(prefs)
// ← stop { prefs: { cuisine: "italian", notes: "extra spicy" } }

IMPORTANT:
- Do NOT wrap ask() content in \`<form>\`. The host provides the form wrapper and submit button.
- Always call await stop() right after ask() to see the values. Do NOT use the values before calling stop().
- After stop(), you resume in a new turn with the form data visible.`;

const TASKLIST_DOCS = `### tasklist(tasklistId, description, tasks) — Declare a task plan with milestones
Before starting any implementation work, declare a plan using tasklist(). This registers milestones with the host under a unique tasklistId. Each task has an id, instructions, and outputSchema describing the result shape. Tasks can optionally declare dependsOn (array of task IDs) for DAG dependencies, condition (JS expression for conditional execution), and optional (boolean, if true failure doesn't block dependents).

When no task has dependsOn, the tasklist behaves sequentially (backward compatible).

You can call tasklist() multiple times per session with different tasklist IDs. It does not block execution.

Example:
tasklist("analyze_data", "Analyze employee data", [
  { id: "load", instructions: "Load the dataset", outputSchema: { count: { type: "number" } } },
  { id: "analyze", instructions: "Compute statistics", outputSchema: { done: { type: "boolean" } }, dependsOn: ["load"] },
  { id: "report", instructions: "Present results", outputSchema: { done: { type: "boolean" } }, dependsOn: ["analyze"] }
])

### completeTask(tasklistId, taskId, output) — Mark a milestone as complete
When you reach a milestone, call completeTask() with the tasklist ID, task ID, and an output object matching the declared outputSchema. Non-blocking. Task must be in the readyTasks set (all dependencies satisfied).

Example:
completeTask("analyze_data", "load", { count: 10 })`;

const SLEEP_DOCS = `### await sleep(seconds) — Pause execution
Pauses sandbox execution (not the LLM stream). Async tasks continue during sleep. Use to wait for completeTaskAsync results, then call stop() to read them.

Example:
await sleep(5)
await stop()`;

const PIN_DOCS = `### pin(key, value) — Pin a value to persistent memory
Saves a value that survives stop-payload decay indefinitely. Pinned values appear in a {{PINNED}} block in the system prompt, visible every turn. Max 10 pins. Use for critical schema info, API keys, or configuration that must persist.

Example:
pin("userSchema", { id: "uuid", name: "string", email: "string" })`;

const MEMO_DOCS = `### memo(key, value?) — Compressed semantic memory
Write a compressed note (max 500 chars) that persists in the {{MEMO}} block across all turns. Unlike pin() which stores raw values, memo() stores your own distilled summaries. Use it to remember decisions, patterns discovered, or strategy.

Write: memo("data-shape", "Users table: 12 cols. Key: id (uuid), email (unique). FK: org_id → orgs.")
Read: var note = memo("data-shape") → returns the string or undefined
Delete: memo("data-shape", null)

Max 20 memos. Memos never decay — delete them when no longer needed.`;

const FOCUS_DOCS = `### focus(...sections) — Control prompt section expansion
Collapses unused system prompt sections to save tokens. Sections: 'functions', 'knowledge', 'components', 'classes', 'agents'. Collapsed sections show a one-line summary. Call focus('all') to restore full expansion.

Example:
focus("functions", "knowledge")  // expand only these, collapse others
// ... later, when done with knowledge:
focus("functions")               // collapse knowledge too
focus("all")                     // restore everything`;

const FORK_DOCS = `### await fork({ task, context?, outputSchema?, maxTurns? }) — Lightweight sub-agent
Runs a focused sub-reasoning task in an isolated context. The child's full reasoning stays separate — only the final JSON output enters your context. Use for complex analysis that would pollute your main conversation. Default 3 turns.

Example:
var analysis = await fork({
  task: "Analyze this error trace and identify the root cause",
  context: { errorTrace: traceStr, codeSnippet: snippet },
  outputSchema: { rootCause: { type: "string" }, fix: { type: "string" }, confidence: { type: "number" } },
  maxTurns: 2,
})
await stop(analysis)`;

const COMPRESS_DOCS = `### await compress(data, options?) — LLM-powered data compression
Compresses large data into a token-efficient summary before it enters your context. Use proactively on large API responses or file contents. Options: preserveKeys (keep exact), maxTokens (target ~200), format ("structured"|"prose").

Example:
var summary = await compress(largeApiResponse, { preserveKeys: ["id", "status"], maxTokens: 150 })
await stop(summary)`;

const SPECULATE_DOCS = `### await speculate(branches, options?) — Parallel hypothesis testing
Run multiple approaches concurrently and compare results. Each branch runs its function in parallel. Failed branches are captured, not thrown. Max 5 branches, default 10s timeout.

Example:
var trial = await speculate([
  { label: "regex", fn: () => data.match(/pattern/g)?.length ?? 0 },
  { label: "split", fn: () => data.split("delimiter").length - 1 },
])
await stop(trial)`;

const REFLECT_DOCS = `### await reflect({ question, context?, criteria? }) — Self-evaluation
Triggers a separate LLM call to evaluate your current approach. Returns { assessment, scores, suggestions, shouldPivot }. Use when uncertain about correctness, efficiency, or when stuck.`;

const WATCH_DOCS = `### watch(variableName, callback) — Reactive variable observation
Registers a callback that fires when a sandbox variable's value changes between stop() calls. Returns an unwatch function.`;

const PIPELINE_DOCS = `### await pipeline(data, ...transforms) — Chained data transformations
Passes data through a sequence of named transforms. Each receives the output of the previous one. Supports async transforms. Stops on first error.`;

const CACHE_FETCH_DOCS = `### await cachedFetch(url, options?) — HTTP fetch with caching and retry
Fetches a URL with built-in TTL caching, exponential backoff retry, auto JSON/text parsing, and timeout.`;

const SCHEMA_DOCS = `### schema(value) — Infer JSON schema from a runtime value
Analyzes a runtime value and returns its JSON schema (type, properties, items, required).`;

const VALIDATE_DOCS = `### validate(value, schema) — Validate against a schema
Checks a value against a JSON-like schema. Returns { valid: true } or { valid: false, errors: ["..."] }.`;

const BROADCAST_DOCS = `### broadcast(channel, message) — Send data to listeners
Sends a message to all agents listening on a channel (including yourself). Use for event-driven coordination between parallel tasks.

Example:
broadcast("user_count_changed", { from: oldVal, to: newVal })
// Any agent with listen() on this channel receives the message

### listen(channel, callback) — Subscribe to broadcasts
Registers a callback that fires when any agent broadcasts on the channel. Returns an unsubscribe function.

Example:
var unsub = listen("user_count_changed", (msg) => {
  console.log("User count changed:", msg)
})`;

const DELEGATE_DOCS = `### await delegate(agent, input) — Delegate to specialist agent
Runs a specialist agent with a focused task. The agent's full reasoning happens separately — only the final JSON output enters your context. Use for modular problem-solving.`;

const PARALLEL_DOCS = `### await parallel(...tasks) — Wait for multiple async tasks
Runs multiple async functions concurrently and returns their results. Use with completeTaskAsync or other async work. Returns { label, ok, result/error, durationMs } for each task.`;

const TRACE_DOCS = `### trace() — Execution profiling snapshot
Returns timing data: turns, LLM calls, token usage, cost estimates, async task status, scope size. Use to optimize performance-critical sections.`;

const PLAN_DOCS = `### await plan(goal, constraints?) — Generate task plan via LLM
Generates a structured task plan from a natural language goal. Returns array of tasks with id, instructions, and optional dependsOn for DAG.`;

const CRITIQUE_DOCS = `### await critique(output, criteria, context?) — Quality evaluation
Evaluates output quality against criteria using a separate LLM call. Returns { passed, scores, suggestions }.`;

const LEARN_DOCS = `### await learn(topic, insight, tags?) — Persist to long-term memory
Saves a learning to the knowledge base for cross-session memory. The insight is compressed and stored as a knowledge option in the memory domain.

Example:
await learn("csv-gotchas", "CSV parsing with split(',') fails on quoted commas. Use regex or a proper parser.", ["csv", "parsing"])`;

const CHECKPOINT_DOCS = `### checkpoint() — Save current sandbox state
Snapshots all sandbox variables so you can explore risky operations and roll back if needed. Returns a checkpoint ID that you can pass to rollback().

Example:
var snapshot = checkpoint()
try {
  riskyOperation(data)
} catch {
  rollback(snapshot)
  stop("Failed, reverted to checkpoint")
}`;

const ROLLBACK_DOCS = `### rollback(snapshot) — Restore sandbox state
Restores all variables to a previously saved checkpoint. Use to recover from errors or failed experiments.`;

const VECTORSEARCH_DOCS = `### await vectorSearch(query, topK?) — Semantic search past reasoning
Searches your comment blocks and code from previous turns for semantically similar content. Uses TF-IDF cosine similarity to find related reasoning patterns.

Example:
var patterns = await vectorSearch("how to aggregate by region")
await stop(patterns)`;

export function buildGlobalsSection(config: SystemPromptConfig, focus: FocusController): string {
  if (focus.isExpanded('globals')) {
    let content = '<globals>\n<system>';
    content += '\n' + STOP_DOCS;
    content += '\n' + DISPLAY_DOCS;
    content += '\n' + ASK_DOCS;
    content += '\n' + TASKLIST_DOCS;
    content += '\n' + SLEEP_DOCS;
    content += '\n' + PIN_DOCS;
    content += '\n' + MEMO_DOCS;
    content += '\n' + FOCUS_DOCS;
    content += '\n' + FORK_DOCS;
    content += '\n' + COMPRESS_DOCS;
    content += '\n' + SPECULATE_DOCS;
    content += '\n' + REFLECT_DOCS;
    content += '\n' + WATCH_DOCS;
    content += '\n' + PIPELINE_DOCS;
    content += '\n' + CACHE_FETCH_DOCS;
    content += '\n' + SCHEMA_DOCS;
    content += '\n' + VALIDATE_DOCS;
    content += '\n' + BROADCAST_DOCS;
    content += '\n' + DELEGATE_DOCS;
    content += '\n' + PARALLEL_DOCS;
    content += '\n' + TRACE_DOCS;
    content += '\n' + PLAN_DOCS;
    content += '\n' + CRITIQUE_DOCS;
    content += '\n' + LEARN_DOCS;
    content += '\n' + CHECKPOINT_DOCS;
    content += '\n' + ROLLBACK_DOCS;
    content += '\n' + VECTORSEARCH_DOCS;

    // Add class signatures if provided
    if (config.classSignatures) {
      content += '\n' + config.classSignatures;
    }

    content += '\n</system>';
    content += '\n</globals>';
    return content;
  }

  return focus.collapse('globals', '', 'Global functions documentation');
}

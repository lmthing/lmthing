import { readFileSync } from 'node:fs'
import { referencedTaskIds } from './condition-dsl.js'

/**
 * Compile an LMThing tasklist DAG (a `Record<string, TaskNode>` as produced by
 * `./load.js`) into a `@deepseek-ai/dsh-workflow` orchestration script.
 *
 * Unlike the other plugins in this family (`space-functions`, `space-persona`,
 * `space-delegate`) this is not a runtime loader — it is a COMPILER. dsh-workflow
 * has no on-disk declarative graph format at all: its whole model is "the model
 * writes a JS orchestration script (`agent`/`parallel`/`pipeline`/`phase`/`log`
 * over an `args` global) at call time; a worker thread runs it once, no
 * journaling, no resume" (see `@deepseek-ai/dsh-workflow-worker-thread`'s
 * README, "Script contract"). Since a tasklist's whole graph IS known
 * statically, a host-side compiler is the faithful bridge: the author writes a
 * DAG, we emit the script, the model never sees script text (it sees one
 * ordinary named tool per action — see `./index.js`).
 *
 * ## What maps cleanly (no compromise)
 *
 * `dependsOn`, `condition`, `forEach`, `goal`, `subgraph` (by compile-time
 * lexical inlining — arguably BETTER than dsh-workflow offers natively, which
 * is nothing: "a workflow script receives no `workflow()` hook for recursive
 * orchestration"), a task's `output:` type map (→ `agent()`'s structured-output
 * `schema` option), a task's `model:`, `optional`, and tasklist-level `input:`
 * (→ the workflow's own `args` global).
 *
 * ## What is REFUSED, loudly (see `validateTask`)
 *
 * `kind: 'code'`, `kind: 'checkpoint'`, `onFail`, `prelude`, `capabilities`,
 * `functions` (INCLUDING `functions: []`), `canDelegateTo`, and any
 * `role` other than `general`. Each has no target in dsh-workflow, and
 * silently ignoring the last four would GRANT MORE PRIVILEGE THAN AUTHORED —
 * dsh subagents join the parent preset's full grant, with no per-`agent()`-call
 * capability-narrowing, tool-allowlist or delegation-target knob. A real,
 * currently-shipped LMThing tasklist
 * (`sdk/org/libs/core/system-spaces/user-thing/tasklists/write_fact/`) trips
 * these on all three of its nodes, and is expected NOT to compile — see
 * `test/compile.test.js`.
 *
 * ## Deliberate divergences from LMThing's own orchestrator, all documented
 *
 *  - **A `condition`'s referenced task ids become real edges.** LMThing
 *    evaluates a condition against every output produced so far and doesn't
 *    require the referenced tasks in `dependsOn`; here they are merged into the
 *    dependency set (so the value is genuinely awaited) and a reference to a
 *    non-task throws at compile time. Stricter, and it catches an authoring
 *    typo LMThing silently evaluates to `undefined`.
 *  - **`forEach` over a non-array throws.** LMThing's `resolveForEachItems`
 *    coerces anything else to `[]` (a silently-empty fan-out).
 *  - **Zero `goal: true` tasks is a compile error.** LMThing falls back to the
 *    last task in file order; a generated script should not guess.
 *  - **Multiple `goal: true` tasks are allowed** and return an object keyed by
 *    each goal's task id. LMThing's `validateDag` rejects more than one.
 *  - **A non-`optional` task whose child failed halts the whole tasklist.**
 *    LMThing retries/salvages per element with an attempt budget; that needs
 *    the durable state dsh-workflow does not have (the same root cause that
 *    makes `onFail` unmappable), so a required failure is fatal rather than
 *    silently continuing with a hole.
 *
 * @typedef {import('./load.js').TaskNode} TaskNode
 *
 * @param {Record<string, TaskNode>} tasks
 * @param {{ name: string, description: string, hasInput?: boolean, resolveSubgraph?: (name: string) => Record<string, TaskNode> }} opts
 * @returns {{ meta: { name: string, description: string }, script: string }} `meta`/`script` match `WorkflowStartRequest` exactly, so a caller passes them straight to `ctx.workflowEngine.start()`.
 */
export function compileTasklistToWorkflowScript(tasks, opts = {}) {
  const { name, description } = opts
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('compileTasklistToWorkflowScript: opts.name is required (it becomes the workflow meta name)')
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new Error(`compileTasklistToWorkflowScript: opts.description is required for tasklist "${name}" (it becomes the workflow meta description)`)
  }
  if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks)) {
    throw new Error(`compileTasklistToWorkflowScript: tasks for "${name}" must be a Record<string, TaskNode>`)
  }

  const state = {
    /** Monotonic scope counter, threaded through subgraph recursion so nested inlinings never collide on a variable name. */
    counter: 0,
    /** Set once any compiled task has a `condition`, so the DSL preamble is only spliced in when it's actually used. */
    usesCondition: false,
    resolveSubgraph: typeof opts.resolveSubgraph === 'function' ? opts.resolveSubgraph : undefined,
    /** Tasklist names currently being inlined — a re-entry is a compile-time cycle. */
    inlining: [],
  }

  const seedVar = opts.hasInput ? '__seed0' : null
  const body = []
  if (seedVar) {
    // `args` is only DEFINED as a vm global when the start request carried one,
    // so `typeof` (never throws on an undeclared name) is the only safe probe.
    body.push(`const ${seedVar} = (typeof args === 'undefined' || args === null) ? {} : args;`)
  }
  body.push(...emitScope(tasks, { resultsVar: '__r0', seedVar, indent: '', state, scopeLabel: name }))

  const chunks = [CONTAIN_HELPER]
  if (state.usesCondition) chunks.push(conditionDslPreamble())
  chunks.push(body.join('\n'))

  return { meta: { name, description }, script: `${chunks.join('\n\n')}\n` }
}

/**
 * Every task promise gets a no-op rejection consumer. A task nothing else
 * awaits (not a goal, nothing depends on it) would otherwise become an
 * unhandled rejection inside the worker thread and kill it; an awaiting task
 * still observes the rejection normally, because `contain` returns the SAME
 * promise (the trick the engine itself uses on its own hook promises — see
 * `WorkflowExecution.contain`).
 */
const CONTAIN_HELPER = `// Keep a dropped task promise's rejection from killing the worker thread; an
// awaiting task still observes it (the same containment the engine applies to
// its own hook promises).
function __contain(p) { p.then(() => {}, () => {}); return p; }`

let conditionDslSource

/**
 * The ported condition DSL's WHOLE module source, `export` stripped, spliced in
 * as the generated script's preamble. Read from disk rather than duplicated as
 * a string literal so `condition-dsl.js` stays the single source of truth for
 * the grammar — a fix there reaches every compiled script with no second edit.
 * @returns {string}
 */
function conditionDslPreamble() {
  conditionDslSource ??= readFileSync(new URL('./condition-dsl.js', import.meta.url), 'utf8').replace(/^export /gm, '')
  return conditionDslSource
}

/**
 * Refuse, with a distinct message per field, every task field dsh-workflow has
 * no target for. Called for EVERY task, including ones pulled in by subgraph
 * inlining.
 * @param {string} id
 * @param {TaskNode} task
 * @param {string} scopeLabel
 */
export function validateTask(id, task, scopeLabel = 'tasklist') {
  const where = `Task "${id}" (${scopeLabel})`

  if (task.kind === 'code') {
    throw new Error(`${where}: a \`kind: "code"\` node cannot be compiled. A dsh workflow script gets no filesystem, network, timers or Node API — only agent()/parallel()/pipeline()/phase()/log() and the args global — so a code node doing real host I/O has nothing to compile to. Rewrite it as an agent node, or run this tasklist on a host that is not dsh-workflow.`)
  }
  if (task.kind === 'checkpoint') {
    throw new Error(`${where}: a \`checkpoint: true\` node cannot be compiled. dsh-workflow has no journaling or resume ("a process restart cannot continue a run"), so a durable "last green" marker has nothing to compile to.`)
  }
  if (task.onFail !== undefined) {
    throw new Error(`${where}: "onFail" cannot be compiled. Goto-resume-with-an-attempt-budget needs the durable per-node state dsh-workflow does not have (the same root cause as \`checkpoint\`). Remove it, or accept that a required failure halts the tasklist.`)
  }
  if (task.prelude !== undefined) {
    throw new Error(`${where}: "prelude" cannot be compiled. There is no mechanism to run host statements inside a dsh child's own VM before its first turn — a child receives a prompt, nothing else.`)
  }
  if (task.capabilities !== undefined) {
    throw new Error(`${where}: "capabilities" cannot be compiled. A dsh subagent JOINS the parent preset's full grant; there is no per-agent()-call capability-narrowing knob, so honoring this is impossible and IGNORING it would grant MORE privilege than authored (capabilities: [${task.capabilities.join(', ')}]).`)
  }
  if (task.functions !== undefined) {
    throw new Error(`${where}: "functions" cannot be compiled. There is no per-agent()-call tool-allowlist knob, so ignoring it would grant MORE space-function access than authored. An empty list ("functions: []") is NOT special-cased away — it still signals "restrict this node to nothing", and promoting such a node to the ambient default is exactly the privilege escalation this refusal exists to catch.`)
  }
  if (task.canDelegateTo !== undefined) {
    throw new Error(`${where}: "canDelegateTo" cannot be compiled. There is no per-agent()-call delegation-target restriction, so ignoring it would let this node reach delegates the author excluded.`)
  }
  if (task.role !== undefined && task.role !== 'general') {
    throw new Error(`${where}: "role: ${task.role}" cannot be compiled. An enforced read-only/plan-only mode needs a pre-registered matching dsh agentType, which this compiler does not assume exists — and an unenforced role is a false guarantee.`)
  }
  if (task.kind === 'agent' && (typeof task.instruction !== 'string' || task.instruction.trim() === '')) {
    throw new Error(`${where}: an agent node needs a non-empty instruction body — agent() rejects an empty prompt string outright ("agent() requires a non-empty prompt string").`)
  }
}

/**
 * The full dependency set of one task: `dependsOn`, the upstream id implied by
 * `forEach` (the head segment), and every id its `condition` references, merged
 * and de-duplicated in that order. Every entry must name a real sibling task;
 * a self-reference or an unknown id throws.
 * @param {string} id
 * @param {TaskNode} task
 * @param {Record<string, TaskNode>} tasks
 * @param {string} scopeLabel
 * @returns {string[]}
 */
export function mergedDependencies(id, task, tasks, scopeLabel = 'tasklist') {
  const deps = []
  const add = (dep, why) => {
    if (dep === id) {
      throw new Error(`Task "${id}" (${scopeLabel}): ${why} names the task itself — a task cannot depend on its own output`)
    }
    if (!Object.hasOwn(tasks, dep)) {
      throw new Error(`Task "${id}" (${scopeLabel}): ${why} names unknown task "${dep}" (this tasklist has: ${Object.keys(tasks).join(', ')})`)
    }
    if (!deps.includes(dep)) deps.push(dep)
  }

  for (const dep of task.dependsOn ?? []) add(dep, `dependsOn entry "${dep}"`)
  if (task.forEach) add(task.forEach.split('.')[0], `forEach "${task.forEach}"`)
  if (task.condition) {
    let refs
    try {
      refs = referencedTaskIds(task.condition)
    } catch (error) {
      throw new Error(`Task "${id}" (${scopeLabel}): condition "${task.condition}" does not parse — ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const ref of refs) add(ref, `condition "${task.condition}"`)
  }
  return deps
}

/**
 * Kahn's algorithm over the merged dependency sets. Deterministic: ready tasks
 * keep `Object.keys` order, which `load.js` fills in sorted NN-prefix file
 * order, so a given tasklist always compiles to a byte-identical script.
 * @param {string[]} ids
 * @param {Record<string, string[]>} deps
 * @param {string} scopeLabel
 * @returns {string[]}
 */
export function topologicalOrder(ids, deps, scopeLabel = 'tasklist') {
  const indegree = new Map(ids.map((id) => [id, deps[id].length]))
  const dependents = new Map(ids.map((id) => [id, []]))
  for (const id of ids) for (const dep of deps[id]) dependents.get(dep).push(id)

  const ready = ids.filter((id) => indegree.get(id) === 0)
  const order = []
  while (ready.length > 0) {
    const id = ready.shift()
    order.push(id)
    for (const dependent of dependents.get(id)) {
      const remaining = indegree.get(dependent) - 1
      indegree.set(dependent, remaining)
      if (remaining === 0) ready.push(dependent)
    }
  }

  if (order.length !== ids.length) {
    const stuck = ids.filter((id) => !order.includes(id))
    throw new Error(`Tasklist "${scopeLabel}" has a dependency cycle among: ${stuck.join(', ')}`)
  }
  return order
}

/**
 * Emit one lexical scope's worth of script: a `results` object, one line per
 * task in topological order, then the goal return. Used for the tasklist
 * itself AND — recursively, at a deeper indent, inside a subgraph node's own
 * IIFE — for every inlined child tasklist.
 *
 * Every task compiles to `results[id] = __contain((async () => { ... })());`.
 * Because JS runs an async IIFE's body synchronously up to its first `await`
 * AT DECLARATION TIME regardless of source order, this yields genuine
 * DAG-parallel execution — a task that does not depend on a slow sibling never
 * waits for it — rather than the wave-by-wave stepping a naive port would give.
 */
function emitScope(tasks, { resultsVar, seedVar, indent, state, scopeLabel }) {
  const ids = Object.keys(tasks)
  if (ids.length === 0) {
    throw new Error(`Tasklist "${scopeLabel}" has no task nodes to compile`)
  }
  for (const id of ids) validateTask(id, tasks[id], scopeLabel)

  const deps = {}
  for (const id of ids) deps[id] = mergedDependencies(id, tasks[id], tasks, scopeLabel)

  const order = topologicalOrder(ids, deps, scopeLabel)

  const goals = ids.filter((id) => tasks[id].goal === true)
  if (goals.length === 0) {
    throw new Error(`Tasklist "${scopeLabel}" has no goal task — mark at least one task \`goal: true\` so the compiled workflow knows what to return (unlike LMThing's own orchestrator, this compiler does not guess the last task in file order)`)
  }

  const out = [`${indent}const ${resultsVar} = {};`]
  for (const id of order) {
    out.push(...emitTask(id, tasks[id], { resultsVar, seedVar, deps: deps[id], indent, state, scopeLabel }))
  }
  // Await EVERY task, not just the goal's ancestors: LMThing runs every node in
  // the DAG, and this is also what surfaces a failure in a side branch instead
  // of letting __contain swallow it.
  out.push(`${indent}await Promise.all(Object.values(${resultsVar}));`)
  if (goals.length === 1) {
    out.push(`${indent}return await ${resultsVar}[${JSON.stringify(goals[0])}];`)
  } else {
    const fields = goals.map((g) => `${JSON.stringify(g)}: await ${resultsVar}[${JSON.stringify(g)}]`)
    out.push(`${indent}return { ${fields.join(', ')} };`)
  }
  return out
}

function emitTask(id, task, { resultsVar, seedVar, deps, indent, state, scopeLabel }) {
  const i1 = `${indent}  `
  const out = [`${indent}${resultsVar}[${JSON.stringify(id)}] = __contain((async () => {`]

  // A task sees the same data LMThing's orchestrator hands a fork: the tasklist
  // seed merged with its upstream outputs keyed by dependency id (plus
  // item/index for a forEach element, below).
  out.push(`${i1}const __deps = ${seedVar ? `{ ...${seedVar} }` : '{}'};`)
  for (const dep of deps) {
    out.push(`${i1}__deps[${JSON.stringify(dep)}] = await ${resultsVar}[${JSON.stringify(dep)}];`)
  }

  if (task.condition) {
    state.usesCondition = true
    out.push(`${i1}if (!evaluateCondition(${JSON.stringify(task.condition)}, __deps)) return null;`)
  }

  const hasInputs = deps.length > 0 || Boolean(seedVar)

  // `forEach` is checked FIRST: a subgraph node can also carry a forEach (fan a
  // whole sub-DAG out over a runtime-produced array — LMThing's slice-per-item
  // pipeline), and `emitForEachBody` handles both element bodies. Testing
  // `kind === 'subgraph'` first would silently DROP the forEach.
  if (task.forEach) {
    out.push(...emitForEachBody(id, task, { indent: i1, state, scopeLabel }))
  } else if (task.kind === 'subgraph') {
    out.push(...emitSubgraphBody(id, task, { indent: i1, state, scopeLabel }))
  } else {
    out.push(...emitAgentBody(id, task, { indent: i1, hasInputs, scopeLabel }))
  }

  out.push(`${indent}})());`)
  return out
}

/** A plain agent node: one `agent()` call over the instruction plus its inputs. */
function emitAgentBody(id, task, { indent, hasInputs, scopeLabel }) {
  const out = []
  out.push(`${indent}const __prompt = ${promptExpression(task.instruction, hasInputs, '__deps')};`)
  out.push(`${indent}const __out = await agent(__prompt, { ${agentOptionFields(id, task).join(', ')} });`)
  if (task.optional) {
    out.push(`${indent}if (__out === null) return null;`)
  } else {
    out.push(`${indent}if (__out === null) throw new Error(${JSON.stringify(requiredFailureMessage(id, scopeLabel))});`)
  }
  out.push(`${indent}return __out;`)
  return out
}

/**
 * A `forEach` node: resolve the upstream array, then one `agent()` (or, for a
 * subgraph node, one whole inlined child scope) per element under `parallel()`.
 * `parallel` is the right combinator rather than `pipeline` because a tasklist
 * fans ONE node over N items, not N items through M stages.
 */
function emitForEachBody(id, task, { indent, state, scopeLabel }) {
  const i1 = `${indent}  `
  const path = task.forEach.split('.')
  const out = []

  out.push(`${indent}let __src = __deps[${JSON.stringify(path[0])}];`)
  for (const segment of path.slice(1)) {
    out.push(`${indent}__src = (__src === null || __src === undefined) ? undefined : __src[${JSON.stringify(segment)}];`)
  }
  const notArray = `Task "${id}" (${scopeLabel}): forEach source "${task.forEach}" did not resolve to an array`
  out.push(`${indent}if (!Array.isArray(__src)) throw new Error(${JSON.stringify(notArray)} + " (got " + (__src === null ? "null" : typeof __src) + ")");`)
  out.push(`${indent}const __items = __src;`)
  out.push(`${indent}const __out = await parallel(__items.map((item, index) => async () => {`)
  out.push(`${i1}const __itemDeps = { ...__deps, item, index };`)

  if (task.kind === 'subgraph') {
    // Fan a whole sub-DAG out over a runtime-produced array. The child scope is
    // emitted INSIDE the thunk, so each element gets its own results object.
    out.push(...emitSubgraphScope(id, task, { indent: i1, state, scopeLabel, seedExpr: '__itemDeps' }))
  } else {
    const label = `${JSON.stringify(id)} + " [" + (index + 1) + "/" + __items.length + "]"`
    const fields = agentOptionFields(id, task, label)
    out.push(`${i1}const __prompt = ${promptExpression(task.instruction, true, '__itemDeps')};`)
    out.push(`${i1}return await agent(__prompt, { ${fields.join(', ')} });`)
  }

  out.push(`${indent}}));`)
  if (task.optional) {
    // `optional` gates whether a failed element sinks the task; the nulls stay
    // in the array so a downstream node can see which elements degraded.
    out.push(`${indent}return __out;`)
  } else {
    out.push(`${indent}if (__out.some((__v) => __v === null)) throw new Error(${JSON.stringify(requiredForEachFailureMessage(id, scopeLabel))});`)
    out.push(`${indent}return __out;`)
  }
  return out
}

/**
 * A plain (non-`forEach`) subgraph node: inline the child scope, return its
 * goal. `optional` is honored by catching anything the inlined child throws —
 * the same "a degraded node resolves to null" semantics an optional agent node
 * gets, rather than silently dropping the flag.
 */
function emitSubgraphBody(id, task, { indent, state, scopeLabel }) {
  if (!task.optional) {
    return emitSubgraphScope(id, task, { indent, state, scopeLabel, seedExpr: '__deps' })
  }
  const i1 = `${indent}  `
  return [
    `${indent}try {`,
    ...emitSubgraphScope(id, task, { indent: i1, state, scopeLabel, seedExpr: '__deps' }),
    `${indent}} catch {`,
    `${i1}return null;`,
    `${indent}}`,
  ]
}

/**
 * Inline one child tasklist as a nested lexical scope. dsh-workflow has no
 * nested-workflow hook at all, but the whole graph is known statically, so a
 * subgraph node becomes a fresh `results`-like object plus the child's own
 * compiled nodes, returning the child's goal value. The scope counter makes
 * every inlining site's variable names unique, so a subgraph of a subgraph
 * never collides.
 *
 * `seedExpr` names the object spread into every child task's inputs — the
 * subgraph node's own resolved upstream outputs (mirroring "the subgraph's seed
 * is the same `{...tasklistSeed, ...upstreamOutputs}` a code node receives"),
 * applied once at the boundary. It is copied into a scope-unique `const`
 * because each child task body declares its OWN `__deps`, which would otherwise
 * shadow the enclosing one.
 */
function emitSubgraphScope(id, task, { indent, state, scopeLabel, seedExpr }) {
  const sub = task.subgraph
  if (!state.resolveSubgraph) {
    throw new Error(`Task "${id}" (${scopeLabel}) is a subgraph node naming "${sub}", but no \`resolveSubgraph\` was supplied to the compiler. Subgraphs are inlined at COMPILE time, so the compiler must be able to load the child tasklist's nodes.`)
  }
  if (state.inlining.includes(sub)) {
    throw new Error(`Task "${id}" (${scopeLabel}): subgraph "${sub}" is already being inlined (${[...state.inlining, sub].join(' -> ')}) — subgraphs are inlined at compile time and cannot recurse.`)
  }

  const child = state.resolveSubgraph(sub)
  if (!child || typeof child !== 'object' || Array.isArray(child) || Object.keys(child).length === 0) {
    throw new Error(`Task "${id}" (${scopeLabel}): subgraph "${sub}" resolved to no task nodes`)
  }

  const n = ++state.counter
  const seedVar = `__seed${n}`
  const resultsVar = `__r${n}`

  state.inlining.push(sub)
  const out = [`${indent}const ${seedVar} = ${seedExpr};`]
  out.push(...emitScope(child, { resultsVar, seedVar, indent, state, scopeLabel: `${scopeLabel} > ${sub}` }))
  state.inlining.pop()
  return out
}

/**
 * The `agent()` options bag fields. `label` gives the run's `workflow/agent-*`
 * events the task's own id (the fan-out case needs the runtime index, so it is
 * passed as an expression rather than a static literal). `model` maps a node's
 * `model:` straight through. `schema` is a task's `output:` type map projected
 * into the enforced JSON-Schema subset — without it `agent()` resolves to the
 * child's final TEXT, which no `condition` path or `forEach` field could ever
 * index.
 */
function agentOptionFields(id, task, labelExpr) {
  const fields = [`label: ${labelExpr ?? JSON.stringify(id)}`]
  if (task.model) fields.push(`model: ${JSON.stringify(task.model)}`)
  const schema = outputObjectSchema(task)
  if (schema) fields.push(`schema: ${JSON.stringify(schema)}`)
  return fields
}

/**
 * LMThing's declared field types (`sdk/org/libs/core/src/tasklist/schema.ts`):
 * `string | number | boolean | object | array | any`, with a trailing `?`
 * marking the field optional. Anything else is treated leniently there, and
 * likewise here (an unconstrained annotation-only node).
 */
function jsonSchemaNodeForType(base) {
  switch (base) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: base }
    case 'object':
      return { type: 'object' }
    case 'array':
      // LMThing's `output:` type map is a flat `field -> type name` string
      // (see TaskNode's doc comment) — it has no notation for an array's
      // element type, so `items` can't be recovered faithfully. `{type:
      // 'array'}` alone passes dsh-tools' own lenient schema-DSL check
      // ("arrays without items receive only a container type check") but is
      // NOT safe to send to a real provider's structured-output/JSON-schema
      // enforcement — this exact gap caused a real incident: a real model
      // call using this schema never failed cleanly, it silently retried
      // the same node hundreds of times in a few minutes (a provider- or
      // adapter-level retry loop entirely outside dsh-workflow's own error
      // surface, which never saw a failure to report). `items: {type:
      // 'string'}` is a deliberate, documented default — the common case
      // for a bare "array" field in this codebase's tasklists — not a
      // faithful recovery of unavailable information.
      return { type: 'array', items: { type: 'string' } }
    default:
      // 'any' and any unrecognized type: annotation-only == unconstrained JSON,
      // which the enforced subset accepts as its standard open form.
      return {}
  }
}

/**
 * A task's `output:` map → the object-rooted JSON Schema `agent()` accepts.
 * `additionalProperties` is deliberately left OPEN: a child that volunteers an
 * extra key would otherwise fail schema validation, come back as `null`, and
 * read as a task failure rather than the harmless over-answer it is.
 * @param {TaskNode} task
 * @returns {{ type: 'object', properties: Record<string, object>, required?: string[] } | null} null when the task declares no output (the child's final text is then the task's value)
 */
export function outputObjectSchema(task) {
  const output = task.output ?? {}
  const keys = Object.keys(output)
  if (keys.length === 0) return null

  const properties = {}
  const required = []
  for (const key of keys) {
    const declared = String(output[key]).trim()
    const optional = declared.endsWith('?')
    properties[key] = jsonSchemaNodeForType(optional ? declared.slice(0, -1) : declared)
    if (!optional) required.push(key)
  }
  const schema = { type: 'object', properties }
  if (required.length > 0) schema.required = required
  return schema
}

/**
 * The prompt expression for one node. The instruction goes through a
 * compile-time `JSON.stringify`, which sidesteps every escaping and
 * template-injection concern outright — no authored text is ever interpolated
 * into a template literal. The inputs ride a fenced JSON block appended at
 * runtime.
 */
function promptExpression(instruction, includeInputs, depsVar) {
  const base = JSON.stringify(instruction ?? '')
  if (!includeInputs) return base
  return `${base} + "\\n\\n## Inputs\\n\\u0060\\u0060\\u0060json\\n" + JSON.stringify(${depsVar}, null, 2) + "\\n\\u0060\\u0060\\u0060"`
}

function requiredFailureMessage(id, scopeLabel) {
  return `Task "${id}" (${scopeLabel}) failed: its agent produced no result. The task is not \`optional: true\`, and dsh-workflow has no durable state to retry or resume from, so the tasklist cannot continue.`
}

function requiredForEachFailureMessage(id, scopeLabel) {
  return `Task "${id}" (${scopeLabel}) failed: at least one forEach element produced no result. The task is not \`optional: true\`, so the tasklist cannot continue (LMThing would retry then salvage the element; that needs durable per-element state dsh-workflow does not have).`
}

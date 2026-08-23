import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTasklist } from '../src/load.js'
import { compileTasklistToWorkflowScript, outputObjectSchema } from '../src/compile.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ------------------------------------------------------------------------- *
 * A stand-in for the real engine's script realm.
 *
 * `@deepseek-ai/dsh-workflow-worker-thread` runs a script as
 * `new vm.Script('(async () => {\n' + body + '\n})()').runInContext(ctx)`, with
 * exactly `agent`/`parallel`/`pipeline`/`phase`/`log`/`args` installed as
 * context globals (see its `WorkflowExecution` constructor). This harness
 * reproduces that shape so the tests assert the generated script actually RUNS
 * — a string-contains assertion alone would not catch a syntax error, a
 * variable collision between nested subgraph scopes, or a wrong await order.
 * ------------------------------------------------------------------------- */
async function runScript(script, { args, agent } = {}) {
  const calls = []
  const context = vm.createContext({})
  context.agent = async (prompt, opts) => {
    const seq = calls.length
    calls.push({ prompt, opts })
    return agent ? await agent(prompt, opts, seq) : `text:${opts?.label ?? seq}`
  }
  // The real `parallel` catches a non-fatal thunk throw and resolves that item to null.
  context.parallel = async (thunks) =>
    Promise.all(thunks.map(async (thunk) => {
      try {
        return await thunk()
      } catch {
        return null
      }
    }))
  context.pipeline = async () => { throw new Error('pipeline() is not emitted by this compiler') }
  context.phase = () => {}
  context.log = () => {}
  if (args !== undefined) context.args = args

  const value = await new vm.Script(`(async () => {\n${script}\n})()`).runInContext(context)
  return { value, calls }
}

/** Minimal well-formed agent node; every test overrides only what it exercises. */
const node = (id, extra = {}) => ({ id, kind: 'agent', instruction: `Do ${id}.`, output: {}, ...extra })

const OPTS = { name: 'demo', description: 'A demo tasklist.' }

/* ========================================================================= *
 * Positive: dependsOn chain
 * ========================================================================= */

test('a 3-node dependsOn chain compiles to one results entry per task', () => {
  const tasks = {
    a: node('a'),
    b: node('b', { dependsOn: ['a'] }),
    c: node('c', { dependsOn: ['b'], goal: true }),
  }
  const { meta, script } = compileTasklistToWorkflowScript(tasks, OPTS)

  assert.deepEqual(meta, { name: 'demo', description: 'A demo tasklist.' })
  assert.match(script, /const __r0 = \{\};/)
  for (const id of ['a', 'b', 'c']) {
    assert.match(script, new RegExp(`__r0\\["${id}"\\] = __contain\\(\\(async \\(\\) => \\{`))
  }
  assert.match(script, /__deps\["a"\] = await __r0\["a"\];/)
  assert.match(script, /__deps\["b"\] = await __r0\["b"\];/)
  assert.match(script, /await Promise\.all\(Object\.values\(__r0\)\);/)
  assert.match(script, /return await __r0\["c"\];/)
})

test('the chain runs in dependency order and returns the goal task\'s value', async () => {
  const tasks = {
    a: node('a'),
    b: node('b', { dependsOn: ['a'] }),
    c: node('c', { dependsOn: ['b'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const { value, calls } = await runScript(script)

  assert.deepEqual(calls.map((c) => c.opts.label), ['a', 'b', 'c'])
  assert.equal(value, 'text:c')
})

test('tasks with no dependency on each other are not serialized behind one another', async () => {
  // `slow` and `fast` are independent; `fast` must start before `slow` settles.
  const tasks = {
    slow: node('slow'),
    fast: node('fast'),
    join: node('join', { dependsOn: ['slow', 'fast'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const started = []
  await runScript(script, {
    agent: async (_prompt, opts) => {
      started.push(opts.label)
      if (opts.label === 'slow') await new Promise((r) => setTimeout(r, 20))
      return opts.label
    },
  })
  assert.deepEqual(started.slice(0, 2), ['slow', 'fast'], 'fast started while slow was still awaiting')
})

test('a task\'s upstream outputs reach its prompt as a fenced JSON inputs block', async () => {
  const tasks = {
    a: node('a', { output: { n: 'number' } }),
    b: node('b', { dependsOn: ['a'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const { calls } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'a' ? { n: 41 } : 'done'),
  })
  const bPrompt = calls.find((c) => c.opts.label === 'b').prompt
  assert.match(bPrompt, /^Do b\./)
  assert.match(bPrompt, /## Inputs\n```json\n/)
  assert.match(bPrompt, /"a": \{\n\s+"n": 41/)
})

/* ========================================================================= *
 * Positive: output: -> agent()'s structured-output schema
 * ========================================================================= */

test('a task\'s output type map becomes agent()\'s object-rooted schema', () => {
  const tasks = {
    a: node('a', {
      goal: true,
      output: { s: 'string', n: 'number', b: 'boolean', o: 'object', arr: 'array', whatever: 'any', maybe: 'string?' },
    }),
  }
  const schema = outputObjectSchema(tasks.a)
  assert.deepEqual(schema, {
    type: 'object',
    properties: {
      s: { type: 'string' },
      n: { type: 'number' },
      b: { type: 'boolean' },
      o: { type: 'object' },
      arr: { type: 'array', items: { type: 'string' } },
      whatever: {},
      maybe: { type: 'string' },
    },
    required: ['s', 'n', 'b', 'o', 'arr', 'whatever'],
  })
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  assert.match(script, /schema: \{"type":"object"/)
})

test('regression: an array-typed output field always carries items — a real incident, not a style preference', () => {
  // A live run against a real model with `arr: { type: 'array' }` (no `items`)
  // never failed cleanly — it silently re-ran the same node hundreds of times
  // in a few minutes, a retry loop entirely outside dsh-workflow's own error
  // surface (dsh-tools' own lenient schema DSL accepts an items-less array,
  // which is why this was never caught by schema-validity tests alone).
  const schema = outputObjectSchema({ output: { tags: 'array' } })
  assert.deepEqual(schema.properties.tags, { type: 'array', items: { type: 'string' } })
})

test('a task that declares no output gets no schema at all (the child\'s text is its value)', () => {
  const { script } = compileTasklistToWorkflowScript({ a: node('a', { goal: true }) }, OPTS)
  assert.doesNotMatch(script, /schema:/)
})

test('a node\'s model: rides straight through to agent()', () => {
  const { script } = compileTasklistToWorkflowScript({ a: node('a', { goal: true, model: 'deepseek-v4-flash' }) }, OPTS)
  assert.match(script, /model: "deepseek-v4-flash"/)
})

/* ========================================================================= *
 * Positive: condition
 * ========================================================================= */

test('a condition-gated node splices in the ported DSL and skips at runtime', async () => {
  const tasks = {
    gate: node('gate', { output: { count: 'number' } }),
    maybe: node('maybe', { dependsOn: ['gate'], condition: 'gate.count > 10' }),
    end: node('end', { dependsOn: ['gate', 'maybe'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)

  // The whole condition-dsl.js module source, export-stripped — one source of truth.
  assert.match(script, /function evaluateCondition\(expr, outputs\)/)
  assert.match(script, /if \(!evaluateCondition\("gate\.count > 10", __deps\)\) return null;/)

  const { value, calls } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'gate' ? { count: 3 } : `ran:${opts.label}`),
  })
  assert.deepEqual(calls.map((c) => c.opts.label), ['gate', 'end'], 'no agent was spawned for the skipped node')
  assert.equal(value, 'ran:end')
  assert.match(calls[1].prompt, /"maybe": null/, 'the skipped node reaches its dependents as null')
})

test('a satisfied condition lets the node run', async () => {
  const tasks = {
    gate: node('gate', { output: { count: 'number' } }),
    maybe: node('maybe', { dependsOn: ['gate'], condition: 'gate.count > 10', goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const { value } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'gate' ? { count: 42 } : 'ran'),
  })
  assert.equal(value, 'ran')
})

test('the DSL preamble is omitted when no task has a condition', () => {
  const { script } = compileTasklistToWorkflowScript({ a: node('a', { goal: true }) }, OPTS)
  assert.doesNotMatch(script, /evaluateCondition/)
})

test('a condition-referenced task becomes a real dependency edge even without dependsOn', async () => {
  const tasks = {
    gate: node('gate', { output: { ok: 'boolean' } }),
    // No dependsOn at all — the edge comes only from the condition reference.
    end: node('end', { condition: 'gate.ok == true', goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  assert.match(script, /__deps\["gate"\] = await __r0\["gate"\];/)
  const { value } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'gate' ? { ok: true } : 'ran'),
  })
  assert.equal(value, 'ran')
})

test('a condition referencing a non-task is a compile error, not a silent undefined', () => {
  const tasks = { a: node('a', { condition: 'nope.x == 1', goal: true }) }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /Task "a" \(demo\): condition "nope\.x == 1" names unknown task "nope"/,
  )
})

/* ========================================================================= *
 * Positive: forEach
 * ========================================================================= */

test('a forEach node compiles to parallel() over the upstream array', async () => {
  const tasks = {
    plan: node('plan', { output: { items: 'array' } }),
    each: node('each', { dependsOn: ['plan'], forEach: 'plan.items', output: { v: 'string' }, goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  assert.match(script, /await parallel\(__items\.map\(\(item, index\) => async \(\) => \{/)
  assert.match(script, /const __itemDeps = \{ \.\.\.__deps, item, index \};/)

  const { value, calls } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'plan' ? { items: ['x', 'y', 'z'] } : { v: opts.label }),
  })
  assert.deepEqual(calls.map((c) => c.opts.label), ['plan', 'each [1/3]', 'each [2/3]', 'each [3/3]'])
  assert.deepEqual(value, [{ v: 'each [1/3]' }, { v: 'each [2/3]' }, { v: 'each [3/3]' }])
  assert.match(calls[1].prompt, /"item": "x"/)
  assert.match(calls[1].prompt, /"index": 0/)
})

test('forEach with no dot fans out over the whole upstream value', async () => {
  const tasks = {
    plan: node('plan'),
    each: node('each', { dependsOn: ['plan'], forEach: 'plan', goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const { value } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'plan' ? [1, 2] : opts.label),
  })
  assert.deepEqual(value, ['each [1/2]', 'each [2/2]'])
})

test('a forEach source that is not an array throws at runtime, naming the task and the ref', async () => {
  const tasks = {
    plan: node('plan', { output: { items: 'array' } }),
    each: node('each', { dependsOn: ['plan'], forEach: 'plan.items', goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  await assert.rejects(
    () => runScript(script, { agent: async (_p, opts) => (opts.label === 'plan' ? { items: 'nope' } : 'x') }),
    /Task "each" \(demo\): forEach source "plan\.items" did not resolve to an array \(got string\)/,
  )
})

test('a failed forEach element sinks a required task but is kept as null on an optional one', async () => {
  const build = (optional) => ({
    plan: node('plan', { output: { items: 'array' } }),
    each: node('each', { dependsOn: ['plan'], forEach: 'plan.items', goal: true, ...(optional ? { optional: true } : {}) }),
  })
  const oneBad = async (_p, opts) => {
    if (opts.label === 'plan') return { items: ['a', 'b'] }
    return opts.label.includes('[1/') ? null : 'ok'
  }

  await assert.rejects(
    () => runScript(compileTasklistToWorkflowScript(build(false), OPTS).script, { agent: oneBad }),
    /Task "each" \(demo\) failed: at least one forEach element produced no result/,
  )

  const { value } = await runScript(compileTasklistToWorkflowScript(build(true), OPTS).script, { agent: oneBad })
  assert.deepEqual(value, [null, 'ok'])
})

/* ========================================================================= *
 * Positive: tasklist input: -> args
 * ========================================================================= */

test('hasInput seeds every task from the workflow args global', async () => {
  const tasks = {
    a: node('a'),
    b: node('b', { dependsOn: ['a'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, { ...OPTS, hasInput: true })
  assert.match(script, /const __seed0 = \(typeof args === 'undefined' \|\| args === null\) \? \{\} : args;/)

  const { calls } = await runScript(script, { args: { topic: 'kites' } })
  // LMThing hands the tasklist seed to EVERY node, not only the entry ones
  // (orchestrator.ts: `{ ...(seedFor(task) ?? {}), ...upstreamOutputs }`).
  for (const call of calls) assert.match(call.prompt, /"topic": "kites"/)
})

test('a missing args global does not crash a hasInput script', async () => {
  const { script } = compileTasklistToWorkflowScript({ a: node('a', { goal: true }) }, { ...OPTS, hasInput: true })
  const { value } = await runScript(script) // no args installed at all
  assert.equal(value, 'text:a')
})

/* ========================================================================= *
 * Positive: subgraph inlining
 * ========================================================================= */

const CHILD = {
  work: { id: 'work', kind: 'agent', instruction: 'Child work.', output: { r: 'string' } },
  wrap: { id: 'wrap', kind: 'agent', instruction: 'Child wrap.', output: {}, dependsOn: ['work'], goal: true },
}

test('a subgraph node inlines the child scope and returns the child\'s goal', async () => {
  const tasks = {
    seed: node('seed'),
    sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, dependsOn: ['seed'], goal: true },
  }
  const { script } = compileTasklistToWorkflowScript(tasks, { ...OPTS, resolveSubgraph: () => CHILD })

  assert.match(script, /const __seed1 = __deps;/)
  assert.match(script, /const __r1 = \{\};/)
  assert.match(script, /__r1\["work"\] = __contain/)
  assert.match(script, /return await __r1\["wrap"\];/)

  const { value, calls } = await runScript(script, { agent: async (_p, opts) => `ran:${opts.label}` })
  assert.deepEqual(calls.map((c) => c.opts.label), ['seed', 'work', 'wrap'])
  assert.equal(value, 'ran:wrap')
  // The subgraph node's own resolved upstream is the seed for the child's nodes.
  assert.match(calls[1].prompt, /"seed": "ran:seed"/)
})

test('a subgraph inside a subgraph gets its own non-colliding scope variables', async () => {
  const outerChild = {
    inner: { id: 'inner', kind: 'subgraph', subgraph: 'grandchild', instruction: '', output: {}, goal: true },
  }
  const grandchild = {
    deep: { id: 'deep', kind: 'agent', instruction: 'Deep.', output: {}, goal: true },
  }
  const tasks = {
    sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, goal: true },
  }
  const { script } = compileTasklistToWorkflowScript(tasks, {
    ...OPTS,
    resolveSubgraph: (n) => (n === 'child' ? outerChild : grandchild),
  })
  assert.match(script, /const __r1 = \{\};/)
  assert.match(script, /const __r2 = \{\};/)
  assert.match(script, /const __seed2 = __deps;/)

  const { value } = await runScript(script, { agent: async (_p, opts) => `ran:${opts.label}` })
  assert.equal(value, 'ran:deep')
})

test('a forEach subgraph node fans a whole child DAG out over the upstream array', async () => {
  const tasks = {
    plan: node('plan', { output: { slices: 'array' } }),
    build: {
      id: 'build', kind: 'subgraph', subgraph: 'child', instruction: '', output: {},
      dependsOn: ['plan'], forEach: 'plan.slices', goal: true,
    },
  }
  const { script } = compileTasklistToWorkflowScript(tasks, { ...OPTS, resolveSubgraph: () => CHILD })
  const { value, calls } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'plan' ? { slices: ['p', 'q'] } : `ran:${opts.label}`),
  })
  assert.equal(calls.length, 5, 'one plan agent + two child nodes per slice')
  assert.deepEqual(value, ['ran:wrap', 'ran:wrap'])
})

test('a self-referencing subgraph is a compile-time cycle error', () => {
  const selfish = {
    loop: { id: 'loop', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, goal: true },
  }
  assert.throws(
    () => compileTasklistToWorkflowScript(selfish, { ...OPTS, resolveSubgraph: () => selfish }),
    /subgraph "child" is already being inlined \(child -> child\) — subgraphs are inlined at compile time and cannot recurse/,
  )
})

test('a subgraph node without a resolveSubgraph is a compile error', () => {
  const tasks = { sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, goal: true } }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /no `resolveSubgraph` was supplied to the compiler/,
  )
})

test('a child tasklist with no goal task is a compile error naming the inlining path', () => {
  const goalless = { only: { id: 'only', kind: 'agent', instruction: 'x', output: {} } }
  const tasks = { sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, goal: true } }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, { ...OPTS, resolveSubgraph: () => goalless }),
    /Tasklist "demo > child" has no goal task/,
  )
})

test('an optional subgraph node degrades to null instead of sinking the tasklist', async () => {
  const tasks = {
    sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, optional: true },
    end: node('end', { dependsOn: ['sub'], goal: true }),
  }
  const { script } = compileTasklistToWorkflowScript(tasks, { ...OPTS, resolveSubgraph: () => CHILD })
  const { value, calls } = await runScript(script, {
    agent: async (_p, opts) => (opts.label === 'work' ? null : `ran:${opts.label}`),
  })
  assert.equal(value, 'ran:end')
  assert.match(calls.at(-1).prompt, /"sub": null/)
})

/* ========================================================================= *
 * Goal handling
 * ========================================================================= */

test('zero goal tasks is a compile error', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a') }, OPTS),
    /Tasklist "demo" has no goal task — mark at least one task `goal: true`/,
  )
})

test('multiple goal tasks return an object keyed by their task ids', async () => {
  const tasks = { a: node('a', { goal: true }), b: node('b', { goal: true }) }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  assert.match(script, /return \{ "a": await __r0\["a"\], "b": await __r0\["b"\] \};/)
  const { value } = await runScript(script)
  // Spread into a host-realm object: the script's own object literal is created
  // in the vm realm, so a strict deep-equal would fail on the prototype alone.
  assert.deepEqual({ ...value }, { a: 'text:a', b: 'text:b' })
})

/* ========================================================================= *
 * Failure discipline
 * ========================================================================= */

test('a required task whose child failed halts the tasklist', async () => {
  const tasks = { a: node('a'), b: node('b', { dependsOn: ['a'], goal: true }) }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  await assert.rejects(
    () => runScript(script, { agent: async (_p, opts) => (opts.label === 'a' ? null : 'x') }),
    /Task "a" \(demo\) failed: its agent produced no result\./,
  )
})

test('an optional task whose child failed resolves to null and the tasklist continues', async () => {
  const tasks = { a: node('a', { optional: true }), b: node('b', { dependsOn: ['a'], goal: true }) }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  const { value, calls } = await runScript(script, { agent: async (_p, opts) => (opts.label === 'a' ? null : 'x') })
  assert.equal(value, 'x')
  assert.match(calls[1].prompt, /"a": null/)
})

test('a failure in a task nothing awaits still surfaces (it is not swallowed by containment)', async () => {
  // `side` feeds nothing and is not the goal — without the emitted
  // `await Promise.all(Object.values(...))` its rejection would vanish.
  const tasks = { side: node('side'), main: node('main', { goal: true }) }
  const { script } = compileTasklistToWorkflowScript(tasks, OPTS)
  await assert.rejects(
    () => runScript(script, { agent: async (_p, opts) => (opts.label === 'side' ? null : 'ok') }),
    /Task "side" \(demo\) failed/,
  )
})

/* ========================================================================= *
 * DAG validation
 * ========================================================================= */

test('an unknown dependsOn entry is a compile error', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { dependsOn: ['ghost'], goal: true }) }, OPTS),
    /Task "a" \(demo\): dependsOn entry "ghost" names unknown task "ghost" \(this tasklist has: a\)/,
  )
})

test('a self-dependency is a compile error', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { dependsOn: ['a'], goal: true }) }, OPTS),
    /names the task itself — a task cannot depend on its own output/,
  )
})

test('a dependency cycle is a compile error naming every stuck task', () => {
  const tasks = {
    a: node('a', { dependsOn: ['b'] }),
    b: node('b', { dependsOn: ['a'] }),
    c: node('c', { goal: true }),
  }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /Tasklist "demo" has a dependency cycle among: a, b/,
  )
})

test('a forEach naming an unknown task is a compile error', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { forEach: 'ghost.items', goal: true }) }, OPTS),
    /forEach "ghost\.items" names unknown task "ghost"/,
  )
})

test('an agent node with an empty instruction is a compile error (agent() rejects an empty prompt)', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: { id: 'a', kind: 'agent', instruction: '  ', output: {}, goal: true } }, OPTS),
    /an agent node needs a non-empty instruction body/,
  )
})

test('opts.name and opts.description are required', () => {
  assert.throws(() => compileTasklistToWorkflowScript({ a: node('a', { goal: true }) }, {}), /opts\.name is required/)
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { goal: true }) }, { name: 'x' }),
    /opts\.description is required/,
  )
})

test('compiling the same tasklist twice yields a byte-identical script', () => {
  const build = () => ({
    a: node('a', { output: { items: 'array' } }),
    b: node('b', { dependsOn: ['a'], forEach: 'a.items', condition: 'a.items != null' }),
    c: node('c', { dependsOn: ['a', 'b'], goal: true }),
  })
  assert.equal(
    compileTasklistToWorkflowScript(build(), OPTS).script,
    compileTasklistToWorkflowScript(build(), OPTS).script,
  )
})

/* ========================================================================= *
 * Negative: the fail-loud refusal table, in real write_fact frontmatter shapes
 *
 * Every snippet below is adapted from
 * sdk/org/libs/core/system-spaces/user-thing/tasklists/write_fact/ — a real,
 * currently-shipped THING tasklist. All three of its nodes set at least one
 * refused field, so the whole tasklist is expected NOT to compile. That is the
 * design, not a gap: an empty `functions: []` still means "restrict this node
 * to nothing", and promoting such a node to the ambient default is exactly the
 * privilege escalation the refusal exists to catch.
 * ========================================================================= */

const WRITE_FACT_DIR = join(__dirname, '../../../../sdk/org/libs/core/system-spaces/user-thing/tasklists/write_fact')

test('the REAL write_fact tasklist is refused, citing the first node that cannot compile', async () => {
  const tasks = await loadTasklist('write_fact', ['01-classify.md', '02-locate.md', '03-write.md'].map((f) => join(WRITE_FACT_DIR, f)))
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, { name: 'write-fact', description: 'Record a stated fact.' }),
    /Task "classify" \(write-fact\): "functions" cannot be compiled/,
  )
})

test('functions: [] (01-classify.md\'s exact shape) is refused, not special-cased away', () => {
  const tasks = { classify: node('classify', { goal: true, role: 'general', functions: [] }) }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /"functions" cannot be compiled.*An empty list \("functions: \[\]"\) is NOT special-cased away/s,
  )
})

test('capabilities (03-write.md\'s exact shape) is refused, citing the escalation risk', () => {
  const tasks = { write: node('write', { goal: true, capabilities: ['db:read', 'db:write'] }) }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /"capabilities" cannot be compiled.*capabilities: \[db:read, db:write\]/s,
  )
})

test('canDelegateTo (03-write.md\'s exact shape) is refused', () => {
  const tasks = {
    write: node('write', { goal: true, canDelegateTo: ['user-memory/memory', 'system-appbuilder/automator', 'registered:*'] }),
  }
  assert.throws(() => compileTasklistToWorkflowScript(tasks, OPTS), /"canDelegateTo" cannot be compiled/)
})

test('role: explore (01-classify.md / 02-locate.md) is refused; role: general compiles', () => {
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { goal: true, role: 'explore' }) }, OPTS),
    /"role: explore" cannot be compiled/,
  )
  assert.throws(
    () => compileTasklistToWorkflowScript({ a: node('a', { goal: true, role: 'plan' }) }, OPTS),
    /"role: plan" cannot be compiled/,
  )
  assert.doesNotThrow(() => compileTasklistToWorkflowScript({ a: node('a', { goal: true, role: 'general' }) }, OPTS))
})

test('a kind: "code" node is refused, citing the missing filesystem/Node API', () => {
  const tasks = {
    calc: { id: 'calc', kind: 'code', instruction: '', output: { n: 'number' }, codeModulePath: '/x/01-calc.ts', goal: true },
  }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /a `kind: "code"` node cannot be compiled.*no filesystem, network, timers or Node API/s,
  )
})

test('a checkpoint node is refused, citing the missing journaling/resume', () => {
  const tasks = { cp: { id: 'cp', kind: 'checkpoint', instruction: '', output: {}, goal: true } }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, OPTS),
    /a `checkpoint: true` node cannot be compiled.*no journaling or resume/s,
  )
})

test('onFail is refused, citing the same durable-state root cause', () => {
  const tasks = { a: node('a', { goal: true, onFail: { goto: 'a', maxAttempts: 2 } }) }
  assert.throws(() => compileTasklistToWorkflowScript(tasks, OPTS), /"onFail" cannot be compiled/)
})

test('prelude is refused', () => {
  const tasks = { a: node('a', { goal: true, prelude: 'const x = 1;' }) }
  assert.throws(() => compileTasklistToWorkflowScript(tasks, OPTS), /"prelude" cannot be compiled/)
})

test('a refused field inside an INLINED subgraph is caught too', () => {
  const badChild = { c: { id: 'c', kind: 'agent', instruction: 'x', output: {}, goal: true, functions: [] } }
  const tasks = { sub: { id: 'sub', kind: 'subgraph', subgraph: 'child', instruction: '', output: {}, goal: true } }
  assert.throws(
    () => compileTasklistToWorkflowScript(tasks, { ...OPTS, resolveSubgraph: () => badChild }),
    /Task "c" \(demo > child\): "functions" cannot be compiled/,
  )
})

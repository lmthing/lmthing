import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertObjectJsonSchema, parameterSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { resolveTasklistTools, parameterSchemaFromInput, actionToolName } from '../src/resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Real repository fixtures, not toy objects: `system-tasklist-demo` is the
 * purpose-built toy space this package ships for live verification (same
 * precedent as `system-echo` in Phase 2), and `user-thing` is the ported THING
 * space, which declares no tasklists at all.
 */
const DEMO_DIR = join(__dirname, '../../../system-spaces/system-tasklist-demo')
const USER_THING_DIR = join(__dirname, '../../../system-spaces/user-thing')

test('resolves one tool per ACTION, named after the action id', async () => {
  const specs = await resolveTasklistTools(DEMO_DIR, 'planner')
  assert.equal(specs.length, 1)
  assert.equal(specs[0].toolName, 'run_plan_words')
  assert.equal(specs[0].actionId, 'plan_words')
  assert.equal(specs[0].tasklist, 'word_plan')
})

test('the tool description carries the action\'s and the tasklist\'s own prose', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  assert.match(spec.description, /Break a topic into a few angles/)
  assert.match(spec.description, /exercise exactly the four tasklist/)
})

test('the compiled meta matches the WorkflowMeta contract (kebab-case name, one-line description)', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  assert.deepEqual(Object.keys(spec.meta).sort(), ['description', 'name'])
  assert.equal(spec.meta.name, 'word-plan')
  assert.match(spec.meta.name, /^[a-z0-9-]+$/)
  assert.ok(spec.meta.description.length > 0)
  assert.doesNotMatch(spec.meta.description, /\n/, 'meta.description is one line')
})

test('the tool parameters come from the tasklist\'s own input: schema', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  assert.deepEqual(Object.keys(spec.parameters), ['topic'])
  assert.equal(spec.parameters.topic.type, 'string')
  assert.equal(spec.parameters.topic.required, true)
  // Must survive dsh-tools' own compilation, or defineTool would reject it.
  const json = parameterSchemaSpecToJsonSchema(spec.parameters)
  assert.deepEqual(json.required, ['topic'])
  assert.equal(json.properties.topic.type, 'string')
})

test('every agent() schema the demo tasklist emits is inside dsh-tools\' enforced subset', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  const schemas = [...spec.script.matchAll(/schema: (\{.*?\}) \}\);?$/gm)].map((m) => JSON.parse(m[1]))
  assert.ok(schemas.length >= 3, `found ${schemas.length} emitted schemas`)
  for (const schema of schemas) assert.doesNotThrow(() => assertObjectJsonSchema(schema))
})

test('the compiled demo script parses exactly the way the engine parse-checks it', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  // The engine compiles `(async () => {\n<body>\n})()` with lineOffset -1.
  assert.doesNotThrow(() => new vm.Script(`(async () => {\n${spec.script}\n})()`, { filename: `workflow:${spec.meta.name}` }))
})

test('the demo script exercises all four cleanly-mapped features', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  assert.match(spec.script, /const __seed0 = \(typeof args === 'undefined'/, 'tasklist input: -> args')
  assert.match(spec.script, /__deps\["plan"\] = await __r0\["plan"\];/, 'dependsOn')
  assert.match(spec.script, /evaluateCondition\("plan\.count > 20", __deps\)/, 'condition')
  assert.match(spec.script, /await parallel\(__items\.map/, 'forEach')
  assert.match(spec.script, /return await __r0\["summarize"\];/, 'a single goal')
})

test('the demo script runs end to end against a stub agent realm', async () => {
  const [spec] = await resolveTasklistTools(DEMO_DIR, 'planner')
  const labels = []
  const context = vm.createContext({})
  context.args = { topic: 'kites' }
  context.agent = async (prompt, opts) => {
    labels.push(opts.label)
    if (opts.label === 'plan') return { angles: ['history', 'physics', 'craft'], count: 3 }
    if (opts.label.startsWith('detail')) return { angle: prompt.match(/"item": "(\w+)"/)[1], note: 'n' }
    return { summary: 's', angleCount: 3, reviewed: false }
  }
  context.parallel = async (thunks) => Promise.all(thunks.map((t) => t()))
  context.phase = () => {}
  context.log = () => {}

  const value = await new vm.Script(`(async () => {\n${spec.script}\n})()`).runInContext(context)
  assert.deepEqual(labels, ['plan', 'detail [1/3]', 'detail [2/3]', 'detail [3/3]', 'summarize'])
  assert.equal(labels.includes('review'), false, 'the condition-gated node spawned no agent')
  assert.deepEqual({ ...value }, { summary: 's', angleCount: 3, reviewed: false })
})

test('an agent with no tasklist-backed action resolves to no tools', async () => {
  const specs = await resolveTasklistTools(USER_THING_DIR, 'thing')
  assert.deepEqual(specs, [])
})

test('resolveTasklistTools throws for an unknown agent', async () => {
  await assert.rejects(
    () => resolveTasklistTools(DEMO_DIR, 'does-not-exist'),
    /agent "does-not-exist" not found in space/,
  )
})

test('actionToolName normalizes an action id to a conservative tool name', () => {
  assert.equal(actionToolName('plan_words', 'word_plan'), 'run_plan_words')
  assert.equal(actionToolName('Write Fact!', 'write_fact'), 'run_write_fact')
  assert.equal(actionToolName('', 'write_fact'), 'run_write_fact')
})

test('parameterSchemaFromInput maps LMThing\'s whole declared type vocabulary', () => {
  const spec = parameterSchemaFromInput({
    s: 'string', n: 'number', b: 'boolean', o: 'object', a: 'array', x: 'any', maybe: 'string?',
  })
  assert.equal(spec.s.type, 'string')
  assert.equal(spec.n.type, 'number')
  assert.equal(spec.b.type, 'boolean')
  assert.deepEqual({ type: spec.o.type, additionalProperties: spec.o.additionalProperties }, { type: 'object', additionalProperties: true })
  assert.equal(spec.a.type, 'array')
  assert.equal(spec.x.type, 'json')
  assert.equal(spec.maybe.required, undefined, 'a trailing ? marks the field optional')
  assert.equal(spec.s.required, true)
  assert.doesNotThrow(() => parameterSchemaSpecToJsonSchema(spec))
})

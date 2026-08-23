import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTasklist } from '../src/load.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Grounded in a REAL, currently-shipped LMThing tasklist rather than a
 * hand-authored toy — the same convention space-format's own tests follow
 * (they load store/spaces/integration-slack/). This is `user-thing`'s
 * `write_fact`: classify -> locate -> write, and it is the fixture the plan for
 * this package was designed against.
 *
 * Read-only, outside dsh/. These assertions cover PARSING only: `write_fact`
 * deliberately does NOT compile (see compile.test.js), and that separation is
 * the point — the loader is a faithful parse of the on-disk format, the
 * compiler is what refuses what dsh-workflow cannot honor.
 */
const WRITE_FACT_DIR = join(__dirname, '../../../../sdk/org/libs/core/system-spaces/user-thing/tasklists/write_fact')
const WRITE_FACT_FILES = ['01-classify.md', '02-locate.md', '03-write.md'].map((f) => join(WRITE_FACT_DIR, f))

test('loads write_fact\'s three nodes, keyed and ordered by their NN-prefixed files', async () => {
  const tasks = await loadTasklist('write_fact', WRITE_FACT_FILES)
  assert.deepEqual(Object.keys(tasks), ['classify', 'locate', 'write'])
  for (const task of Object.values(tasks)) {
    assert.equal(task.kind, 'agent')
    assert.ok(task.instruction.length > 0, `${task.id} carries its markdown body as the instruction`)
  }
})

test('parses the dependsOn chain and the single goal node', async () => {
  const tasks = await loadTasklist('write_fact', WRITE_FACT_FILES)
  assert.deepEqual(tasks.classify.dependsOn, [])
  assert.deepEqual(tasks.locate.dependsOn, ['classify'])
  assert.deepEqual(tasks.write.dependsOn, ['classify', 'locate'])
  assert.equal(tasks.classify.goal, undefined, 'goal: false is stored as absent, not false')
  assert.equal(tasks.write.goal, true)
})

test('parses each node\'s output type map as strings', async () => {
  const tasks = await loadTasklist('write_fact', WRITE_FACT_FILES)
  assert.deepEqual(tasks.locate.output, { status: 'string', rowId: 'string', candidates: 'string' })
  assert.deepEqual(tasks.write.output, { ok: 'boolean', target: 'string', detail: 'string' })
  assert.deepEqual(Object.keys(tasks.classify.output).sort(), [
    'agent', 'criteria', 'operation', 'question', 'reason', 'spaceKey', 'table', 'target',
  ])
})

test('parses role, and keeps `functions: []` as a real empty array (not dropped)', async () => {
  const tasks = await loadTasklist('write_fact', WRITE_FACT_FILES)
  assert.equal(tasks.classify.role, 'explore')
  assert.equal(tasks.locate.role, 'explore')
  assert.equal(tasks.write.role, 'general')
  // The distinction the compiler's refusal rests on: `functions: []` is
  // PRESENT-and-empty ("restrict to nothing"), not absent ("no restriction").
  assert.deepEqual(tasks.classify.functions, [])
  assert.deepEqual(tasks.locate.functions, [])
  assert.equal(tasks.write.functions, undefined)
})

test('parses write\'s capabilities and canDelegateTo verbatim', async () => {
  const tasks = await loadTasklist('write_fact', WRITE_FACT_FILES)
  assert.deepEqual(tasks.write.capabilities, ['db:read', 'db:write'])
  assert.deepEqual(tasks.write.canDelegateTo, [
    'user-memory/memory',
    'system-appbuilder/automator',
    'registered:*',
  ])
})

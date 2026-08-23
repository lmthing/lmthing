import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSpace } from '@lmthing/dsh-space-format'
import { resolveKnowledge } from '../src/resolve.js'

const here = dirname(fileURLToPath(import.meta.url))
// dsh/packages/space-knowledge/test -> repo root (same convention as space-format's own tests)
const repoRoot = join(here, '..', '..', '..', '..')
const SLACK_DIR = join(repoRoot, 'store', 'spaces', 'integration-slack')
const USER_THING_DIR = join(repoRoot, 'sdk', 'org', 'libs', 'core', 'system-spaces', 'user-thing')
const DEMO_DIR = join(here, '..', '..', '..', 'system-spaces', 'system-knowledge-demo')

const slack = await loadSpace(SLACK_DIR)
const demo = await loadSpace(DEMO_DIR)

test('resolveKnowledge []: overview lists every domain slug', async () => {
  assert.deepEqual(await resolveKnowledge(slack, []), ['slack'])
  assert.deepEqual(await resolveKnowledge(demo, []), ['brewing', 'service'])
})

test('resolveKnowledge [domain]: field overview is { field: { type, options } }', async () => {
  assert.deepEqual(await resolveKnowledge(slack, ['slack']), {
    api: { type: 'string', options: ['auth', 'endpoints'] },
  })
})

test('resolveKnowledge [domain, field]: metadata defaults type to string, variableName to the frontmatter variable', async () => {
  // store/spaces/integration-slack/knowledge/slack/api/index.md sets only
  // `variable: slackApi` + `description` — no `type:` — so `type` must default.
  assert.deepEqual(await resolveKnowledge(slack, ['slack', 'api']), {
    type: 'string',
    variableName: 'slackApi',
    options: ['auth', 'endpoints'],
  })
})

test('resolveKnowledge [domain, field]: a field with no index.md keys defaults variableName to the field slug', async () => {
  assert.deepEqual(await resolveKnowledge(demo, ['brewing', 'grind']), {
    type: 'string',
    variableName: 'grind',
    options: ['coarse', 'fine'],
  })
})

test('resolveKnowledge [domain, field]: an explicit type/variable/default all round-trip', async () => {
  assert.deepEqual(await resolveKnowledge(demo, ['brewing', 'method']), {
    type: "'pourover' | 'espresso' | 'cold-brew'",
    variableName: 'brewMethod',
    default: 'pourover',
    options: ['cold-brew', 'espresso', 'pourover'],
  })
})

test('resolveKnowledge [domain, field]: `default` is an ABSENT key, never undefined (dsh rejects non-lossless JSON)', async () => {
  const meta = await resolveKnowledge(slack, ['slack', 'api'])
  assert.equal('default' in meta, false, '`default` must be omitted, not present-and-undefined')
  // The divergence is only observable via `in` — JSON round-trips identically,
  // which is why this is not a LMThing behavior change. See src/resolve.js.
  assert.equal(JSON.stringify(meta), JSON.stringify({ ...meta, default: undefined }))
})

test('resolveKnowledge [domain, field, option]: a plain-markdown option returns its raw body', async () => {
  // auth.md carries no frontmatter at all.
  const value = await resolveKnowledge(slack, ['slack', 'api', 'auth'])
  assert.equal(typeof value, 'string')
  assert.match(value, /^# Auth \(handled by the gateway\)/)
  // Exactly the file, byte for byte. Note the LMThing quirk this preserves:
  // `parseFrontmatter` trims the body only when there IS frontmatter to strip,
  // so a plain-markdown option comes back untrimmed via the `body ||` branch —
  // `content.trim()` is only reached for a file that is entirely blank.
  const raw = await readFile(join(SLACK_DIR, 'knowledge', 'slack', 'api', 'auth.md'), 'utf8')
  assert.equal(value, raw)
})

test('resolveKnowledge [domain, field, option]: endpoints.md, the fixture\'s second plain option', async () => {
  const value = await resolveKnowledge(slack, ['slack', 'api', 'endpoints'])
  assert.equal(typeof value, 'string')
  assert.match(value, /chat\.postMessage/)
})

test('resolveKnowledge [domain, field, option]: a frontmattered option returns { ...data, body }', async () => {
  const value = await resolveKnowledge(demo, ['brewing', 'method', 'pourover'])
  assert.equal(typeof value, 'object')
  assert.equal(value.description, 'The house filter method — 18 g to 300 g water at 94 °C over 3 minutes.')
  assert.equal(value.icon, 'filter')
  assert.match(value.body, /^# Pour-over/)
  assert.equal(value.body.includes('---'), false, 'frontmatter must not leak into the body')
})

test('resolveKnowledge [domain, field, option]: a real LMThing frontmattered option (user-thing playbooks)', async () => {
  // The real, unported THING space — proof the frontmatter branch works against
  // production content, not only this port's toy fixture.
  const thing = await loadSpace(USER_THING_DIR, { onWarn() {} })
  const value = await resolveKnowledge(thing, ['playbooks', 'paths', 'application'])
  assert.equal(typeof value, 'object')
  assert.equal(typeof value.description, 'string')
  assert.ok(value.description.length > 0)
  assert.ok(value.body.length > 0)
})

test('resolveKnowledge [domain, field, option]: the demo\'s no-frontmatter option returns a string, not an object', async () => {
  const value = await resolveKnowledge(demo, ['brewing', 'method', 'cold-brew'])
  assert.equal(typeof value, 'string')
  assert.match(value, /16 hours/)
})

test('resolveKnowledge: every returned value is lossless JSON (no undefined anywhere)', async () => {
  const paths = [
    [],
    ['slack'],
    ['slack', 'api'],
    ['slack', 'api', 'auth'],
    ['brewing'],
    ['brewing', 'method'],
    ['brewing', 'method', 'pourover'],
    ['brewing', 'method', 'cold-brew'],
  ]
  for (const path of paths) {
    const space = path[0] === 'slack' ? slack : path.length === 0 ? slack : demo
    const value = await resolveKnowledge(space, path)
    assert.equal(hasUndefined(value), false, `${path.join('/') || '(root)'} contains undefined`)
  }
})

function hasUndefined(value) {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasUndefined)
  return Object.values(value).some(hasUndefined)
}

test('resolveKnowledge: unknown domain / field / option each fail loud', async () => {
  await assert.rejects(() => resolveKnowledge(demo, ['nope']), /Knowledge domain "nope" not found/)
  await assert.rejects(
    () => resolveKnowledge(demo, ['brewing', 'nope']),
    /Knowledge field "nope" not found in domain "brewing"/,
  )
  await assert.rejects(
    () => resolveKnowledge(demo, ['brewing', 'method', 'nope']),
    /Knowledge option "nope" not found in field "method" of domain "brewing"/,
  )
})

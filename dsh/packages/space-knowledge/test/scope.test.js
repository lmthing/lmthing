import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSpace } from '@lmthing/dsh-space-format'
import { isPathAllowed, resolveKnowledgeScoped } from '../src/scope.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const DEMO_DIR = join(here, '..', '..', '..', 'system-spaces', 'system-knowledge-demo')
// A real fixture whose three agents each declare ONE field of a shared domain —
// exactly the sibling-field scoping case.
const NEWSROOM_DIR = join(repoRoot, 'store', 'projects', 'blog', 'spaces', 'newsroom')

const demo = await loadSpace(DEMO_DIR)
const newsroom = await loadSpace(NEWSROOM_DIR, { onWarn() {} })

test('isPathAllowed: a domain-only ref allows the domain, its fields and their options', () => {
  const refs = ['service']
  assert.equal(isPathAllowed(['service'], refs), true)
  assert.equal(isPathAllowed(['service', 'hours'], refs), true)
  assert.equal(isPathAllowed(['service', 'hours', 'weekday'], refs), true)
})

test('isPathAllowed: a field-level ref allows its options but NOT its parent domain', () => {
  const refs = ['brewing/method']
  assert.equal(isPathAllowed(['brewing', 'method'], refs), true)
  assert.equal(isPathAllowed(['brewing', 'method', 'pourover'], refs), true)
  // The domain overview would reveal sibling fields, so it is not a prefix match.
  assert.equal(isPathAllowed(['brewing'], refs), false)
})

test('isPathAllowed: a field-level ref does NOT allow a sibling field', () => {
  assert.equal(isPathAllowed(['brewing', 'grind'], ['brewing/method']), false)
  assert.equal(isPathAllowed(['brewing', 'grind', 'coarse'], ['brewing/method']), false)
})

test('isPathAllowed: an option-level ref allows only that option', () => {
  const refs = ['brewing/method/pourover']
  assert.equal(isPathAllowed(['brewing', 'method', 'pourover'], refs), true)
  assert.equal(isPathAllowed(['brewing', 'method', 'espresso'], refs), false)
  assert.equal(isPathAllowed(['brewing', 'method'], refs), false)
})

test('isPathAllowed: an unrelated domain is rejected; a prefix-of-a-name is not a prefix-of-a-path', () => {
  assert.equal(isPathAllowed(['organizing'], ['brewing/method', 'service']), false)
  // "brew" is a string prefix of "brewing" but not a path prefix.
  assert.equal(isPathAllowed(['brewing', 'method'], ['brew']), false)
})

test('isPathAllowed: empty refs allow nothing; the empty path is allowed by nothing', () => {
  assert.equal(isPathAllowed(['service'], []), false)
  assert.equal(isPathAllowed(['service'], undefined), false)
  // The all-domains overview would list undeclared domains — never in scope.
  assert.equal(isPathAllowed([], ['service']), false)
})

test('isPathAllowed: a ref with stray slashes still matches by segment', () => {
  assert.equal(isPathAllowed(['brewing', 'method'], ['/brewing/method/']), true)
  assert.equal(isPathAllowed(['brewing', 'method'], ['brewing//method']), true)
})

test('isPathAllowed: the demo librarian\'s real declared refs scope exactly as authored', () => {
  const refs = demo.agents.librarian.config.knowledge
  assert.deepEqual(refs, ['brewing/method', 'service'])
  assert.equal(isPathAllowed(['brewing', 'method', 'espresso'], refs), true)
  assert.equal(isPathAllowed(['service', 'hours', 'weekend'], refs), true)
  assert.equal(isPathAllowed(['brewing', 'grind', 'fine'], refs), false)
  assert.equal(isPathAllowed(['brewing'], refs), false)
})

test('isPathAllowed: the real newsroom fetcher cannot reach its siblings\' fields', () => {
  const fetcher = newsroom.agents.fetcher.config.knowledge
  assert.deepEqual(fetcher, ['journalism/source-evaluation'])
  assert.equal(isPathAllowed(['journalism', 'source-evaluation', 'credibility-signals'], fetcher), true)
  assert.equal(isPathAllowed(['journalism', 'synthesis-method'], fetcher), false)
  assert.equal(isPathAllowed(['journalism', 'deep-dive-method', 'structuring-a-report'], fetcher), false)
})

test('resolveKnowledgeScoped: an in-scope path resolves normally', async () => {
  const refs = demo.agents.librarian.config.knowledge
  const value = await resolveKnowledgeScoped(demo, ['brewing', 'method', 'espresso'], refs)
  assert.equal(value.description, "The bar's espresso recipe — 20 g in, 40 g out, 27 seconds at 93 °C.")
})

test('resolveKnowledgeScoped: a domain-level ref permits the domain overview', async () => {
  const value = await resolveKnowledgeScoped(demo, ['service'], demo.agents.librarian.config.knowledge)
  assert.deepEqual(value, { hours: { type: 'string', options: ['weekday', 'weekend'] } })
})

test('resolveKnowledgeScoped: an out-of-scope path throws, quoting the path and the declared refs', async () => {
  const refs = demo.agents.librarian.config.knowledge
  await assert.rejects(
    () => resolveKnowledgeScoped(demo, ['brewing', 'grind', 'coarse'], refs),
    (error) => {
      assert.match(error.message, /knowledge path 'brewing\/grind\/coarse' is not declared in this agent's knowledge/)
      assert.match(error.message, /\['brewing\/method', 'service'\]/)
      return true
    },
  )
})

test('resolveKnowledgeScoped: the refused path is never read from disk (an unknown option is refused, not "not found")', async () => {
  // Fail-loud on SCOPE takes precedence over resolve's own not-found error —
  // the model must not be able to probe for existence outside its allowlist.
  await assert.rejects(
    () => resolveKnowledgeScoped(demo, ['brewing', 'grind', 'does-not-exist'], ['brewing/method']),
    /is not declared in this agent's knowledge/,
  )
})

test('resolveKnowledgeScoped: an agent with no declared knowledge can reach nothing', async () => {
  const refs = demo.agents.intern.config.knowledge
  assert.deepEqual(refs, [])
  await assert.rejects(
    () => resolveKnowledgeScoped(demo, ['service', 'hours', 'weekday'], refs),
    /is not declared in this agent's knowledge: \[\]/,
  )
})

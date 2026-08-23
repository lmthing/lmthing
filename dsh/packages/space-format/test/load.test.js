import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadSpace } from '../src/load.js'
import { parseFrontmatter } from '../src/frontmatter.js'
import { parseCapabilities } from '../src/capabilities.js'

const here = dirname(fileURLToPath(import.meta.url))
// dsh/packages/space-format/test -> repo root -> store/{spaces,projects}
const repoRoot = join(here, '..', '..', '..', '..')

test('parseFrontmatter splits YAML frontmatter from body', () => {
  const { data, body } = parseFrontmatter('---\ntitle: Fetcher\n---\n# Body\ntext')
  assert.equal(data.title, 'Fetcher')
  assert.equal(body, '# Body\ntext')
})

test('parseFrontmatter returns empty data for a file with no frontmatter', () => {
  const { data, body } = parseFrontmatter('# Just markdown')
  assert.deepEqual(data, {})
  assert.equal(body, '# Just markdown')
})

test('parseFrontmatter throws on malformed YAML, naming the source', () => {
  assert.throws(
    () => parseFrontmatter('---\nfoo: [1, 2\n---\nbody', '/some/file.md'),
    /Invalid YAML frontmatter in \/some\/file\.md/,
  )
})

test('parseCapabilities: bare capability grants full scope', () => {
  const caps = parseCapabilities(['store:read'], { agentId: 'x' })
  assert.equal(caps['store:read'], true)
})

test('parseCapabilities: db:read narrows to named tables', () => {
  const caps = parseCapabilities([{ 'db:read': { tables: ['sources'] } }], { agentId: 'x' })
  assert.deepEqual(caps['db:read'], { tables: ['sources'] })
})

test('parseCapabilities: unknown id fails loud', () => {
  assert.throws(() => parseCapabilities(['not:a:real:cap'], { agentId: 'x' }), /declares unknown capability/)
})

test('parseCapabilities: bare api:call is rejected (allow is required)', () => {
  assert.throws(() => parseCapabilities(['api:call'], { agentId: 'x' }), /requires a config with an "allow" list/)
})

test('loadSpace: real fixture store/spaces/integration-slack loads and validates', async () => {
  const dir = join(repoRoot, 'store', 'spaces', 'integration-slack')
  const space = await loadSpace(dir)
  assert.ok(space.agents.slack, 'expected a "slack" agent')
  assert.ok(Object.keys(space.functions).length > 0, 'expected functions/ to load')
  assert.equal(Object.keys(space.tasklists).length, 0, 'integration-slack ships no tasklists/')
})

test('loadSpace: real fixture store/projects/blog/spaces/newsroom loads and validates', async () => {
  const dir = join(repoRoot, 'store', 'projects', 'blog', 'spaces', 'newsroom')
  const space = await loadSpace(dir)
  assert.ok(space.agents.fetcher, 'expected a "fetcher" agent')
  assert.ok(space.agents.researcher, 'expected a "researcher" agent')
  assert.ok(space.agents.synthesizer, 'expected a "synthesizer" agent')
  assert.ok(Object.keys(space.tasklists).length > 0, 'expected tasklists/ to load')
  assert.ok(Object.keys(space.knowledge.domains).length > 0, 'expected knowledge/ to load')
  assert.ok(Object.keys(space.components.view).length > 0, 'expected components/view to load')

  // Every function/knowledge ref an agent declares must have resolved (loadSpace
  // throws otherwise) — spot-check fetcher's declared refs actually round-trip.
  const fetcher = space.agents.fetcher
  for (const fnName of fetcher.config.functions) {
    assert.ok(fnName in space.functions, `fetcher's declared function "${fnName}" should be loaded`)
  }
})

test('loadSpace: missing agents/ throws by default', async () => {
  const dir = join(repoRoot, 'dsh', 'packages', 'space-format')
  await assert.rejects(() => loadSpace(dir), /must have an agents\/ directory/)
})

test('loadSpace: requireAgents:false allows a function-only space', async () => {
  const dir = join(repoRoot, 'dsh', 'packages', 'space-format')
  const space = await loadSpace(dir, { requireAgents: false })
  assert.deepEqual(space.agents, {})
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadSpace } from '../src/load.ts'
import { parseFrontmatter } from '../src/frontmatter.ts'
import { parseCapabilities, CAPABILITY_IDS } from '../src/capabilities.ts'
import { validateDag, readyNodes, topoOrder } from '../src/dag.ts'

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
    /some\/file\.md/,
  )
})

test('parseFrontmatter throws on an unterminated fence (Part A1: adopted from mcp, new default)', () => {
  assert.throws(
    () => parseFrontmatter('---\ntitle: x\nno closing fence here', '/some/file.md'),
    /unterminated YAML frontmatter/,
  )
})

test('parseFrontmatter throws on non-mapping frontmatter (Part A1: adopted from mcp, new default)', () => {
  assert.throws(
    () => parseFrontmatter('---\n- a\n- b\n---\nbody', '/some/file.md'),
    /frontmatter must be a mapping/,
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

test('parseCapabilities: self:author is recognized and bare-only (Part A1 bug fix — was missing)', () => {
  const caps = parseCapabilities(['self:author'], { agentId: 'x' })
  assert.equal(caps['self:author'], true)
  assert.throws(
    () => parseCapabilities([{ 'self:author': {} }], { agentId: 'x' }),
    /takes no config \(bare only\)/,
  )
})

test('CAPABILITY_IDS includes self:author (real, documented capability — org/docs/format/space/agents/capabilities.md)', () => {
  assert.ok(CAPABILITY_IDS.has('self:author'))
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

test('loadSpace: real fixture sdk/org/libs/core/system-spaces/user-thing loads and validates (Part A1: the self:author regression)', async () => {
  const dir = join(repoRoot, 'sdk', 'org', 'libs', 'core', 'system-spaces', 'user-thing')
  const space = await loadSpace(dir)
  assert.ok(space.agents.thing, 'expected a "thing" agent')
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

test('loadSpace: knowledge fields carry type/variableName/default metadata AND sorted, deterministic option order', async () => {
  const dir = join(repoRoot, 'store', 'projects', 'blog', 'spaces', 'newsroom')
  const space = await loadSpace(dir)
  const domainSlugs = Object.keys(space.knowledge.domains)
  assert.deepEqual(domainSlugs, [...domainSlugs].sort(), 'domains should enumerate in sorted order')
  for (const domain of Object.values(space.knowledge.domains)) {
    const fieldSlugs = Object.keys(domain.fields)
    assert.deepEqual(fieldSlugs, [...fieldSlugs].sort(), 'fields should enumerate in sorted order')
    for (const field of Object.values(domain.fields)) {
      assert.equal(typeof field.type, 'string')
      assert.equal(typeof field.variableName, 'string')
      assert.ok(field.optionTitles && typeof field.optionTitles === 'object', 'optionTitles should always be present (possibly empty)')
    }
  }
})

// --- dag.ts: ported from mcp/src/format/dag.ts, adapted to a Record<string, DagNode> map ---

test('validateDag: a simple acyclic graph has no problems', () => {
  const nodes = { a: { id: 'a', dependsOn: [] }, b: { id: 'b', dependsOn: ['a'] } }
  assert.deepEqual(validateDag(nodes), [])
})

test('validateDag: detects an unknown dependsOn target', () => {
  const nodes = { a: { id: 'a', dependsOn: ['ghost'], file: 'a.md' } }
  const problems = validateDag(nodes)
  assert.ok(problems.some((p) => p.message.includes('unknown dependsOn target: ghost')))
})

test('validateDag: detects a two-node cycle', () => {
  const nodes = { a: { id: 'a', dependsOn: ['b'], file: 'a.md' }, b: { id: 'b', dependsOn: ['a'], file: 'b.md' } }
  const problems = validateDag(nodes)
  assert.ok(problems.some((p) => p.message.startsWith('cycle:')))
})

test('readyNodes: returns nodes whose dependencies are all satisfied', () => {
  const nodes = { a: { id: 'a', dependsOn: [] }, b: { id: 'b', dependsOn: ['a'] }, c: { id: 'c', dependsOn: ['a', 'b'] } }
  assert.deepEqual(readyNodes(nodes, []), ['a'])
  assert.deepEqual(readyNodes(nodes, ['a']), ['b'])
  assert.deepEqual(readyNodes(nodes, ['a', 'b']), ['c'])
})

test('topoOrder: a stable Kahn ordering for an acyclic graph', () => {
  const nodes = { a: { id: 'a', dependsOn: [] }, b: { id: 'b', dependsOn: ['a'] }, c: { id: 'c', dependsOn: ['a'] } }
  const order = topoOrder(nodes)
  assert.ok(Array.isArray(order))
  assert.equal(order[0], 'a')
})

test('topoOrder: returns a Problem (not a partial order) on a cycle', () => {
  const nodes = { a: { id: 'a', dependsOn: ['b'] }, b: { id: 'b', dependsOn: ['a'] } }
  const result = topoOrder(nodes)
  assert.ok(!Array.isArray(result))
  assert.ok(result.message.length > 0)
})

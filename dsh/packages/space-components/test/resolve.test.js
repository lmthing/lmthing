import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveComponents, resolveComponentsFromSpace } from '../src/resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * The real, currently-shipped LMThing space this plugin is grounded in
 * (read-only reference, same convention as every other fixture in this port).
 * `agents/synthesizer` declares `components: [ArticlePreview]`,
 * `agents/researcher` declares `[ResearchPreview]`, `agents/fetcher` declares
 * none — all three cases in one real fixture.
 */
const NEWSROOM_DIR = join(__dirname, '../../../../store/projects/blog/spaces/newsroom')

test('resolveComponents resolves the synthesizer\'s declared component to the real view/ file', async () => {
  const resolved = await resolveComponents(NEWSROOM_DIR, 'synthesizer')
  assert.equal(resolved.length, 1)

  const [component] = resolved
  assert.equal(component.name, 'ArticlePreview')
  assert.equal(component.kind, 'view')

  const onDisk = await readFile(join(NEWSROOM_DIR, 'components/view/ArticlePreview.tsx'), 'utf8')
  assert.equal(component.source, onDisk)
})

test('resolveComponents resolves the researcher\'s own distinct component', async () => {
  const resolved = await resolveComponents(NEWSROOM_DIR, 'researcher')
  assert.deepEqual(
    resolved.map((c) => ({ name: c.name, kind: c.kind })),
    [{ name: 'ResearchPreview', kind: 'view' }],
  )
})

test('resolveComponents returns [] for an agent that declares no components', async () => {
  // The plugin's "mount nothing" branch depends on exactly this.
  assert.deepEqual(await resolveComponents(NEWSROOM_DIR, 'fetcher'), [])
})

test('resolveComponents throws for an unknown agent', async () => {
  await assert.rejects(
    () => resolveComponents(NEWSROOM_DIR, 'does-not-exist'),
    /agent "does-not-exist" not found/,
  )
})

test('resolveComponentsFromSpace resolves a form/ component', () => {
  const space = {
    dir: '/synthetic',
    agents: { a: { slug: 'a', config: { components: ['SubmitDraft'] } } },
    components: { view: {}, form: { SubmitDraft: 'export function SubmitDraft() {}' } },
  }
  assert.deepEqual(resolveComponentsFromSpace(space, 'a'), [
    { name: 'SubmitDraft', kind: 'form', source: 'export function SubmitDraft() {}' },
  ])
})

test('resolveComponentsFromSpace throws when a declared name is in neither map', () => {
  // Unreachable through `loadSpace` (its own cross-reference validation already
  // rejects this), so it is asserted here with hand-built input that bypasses it.
  const space = {
    dir: '/synthetic',
    agents: { a: { slug: 'a', config: { components: ['Ghost'] } } },
    components: { view: {}, form: {} },
  }
  assert.throws(
    () => resolveComponentsFromSpace(space, 'a'),
    /declares component "Ghost" but it is in neither components\/view nor components\/form/,
  )
})

test('resolveComponentsFromSpace prefers view/ and warns when a name exists in both', () => {
  const warnings = []
  const space = {
    dir: '/synthetic',
    agents: { a: { slug: 'a', config: { components: ['Dupe'] } } },
    components: { view: { Dupe: 'view source' }, form: { Dupe: 'form source' } },
  }
  const resolved = resolveComponentsFromSpace(space, 'a', { onWarn: (m) => warnings.push(m) })
  assert.deepEqual(resolved, [{ name: 'Dupe', kind: 'view', source: 'view source' }])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /exists in BOTH components\/view and components\/form/)
})

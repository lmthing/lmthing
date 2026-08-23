import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plugin from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NEWSROOM_DIR = join(__dirname, '../../../../store/projects/blog/spaces/newsroom')

/**
 * A stub `ctx` exposing only what this plugin injects (`tools.register`). NOT a
 * synthetic Cordis boot — the family's convention is that thin `apply()`
 * wrappers are verified live, not through a fake harness — but capturing the
 * one `ToolDefinition` this plugin registers costs nothing and pins the parts a
 * live run cannot cheaply assert (the enum contents, the mount-nothing branch,
 * and `execute`'s canonical value).
 */
function stubCtx() {
  const registered = []
  return { registered, tools: { register: (def) => registered.push(def) } }
}

test('module exports a valid Plugin.Object shape', () => {
  assert.equal(plugin.name, 'lmthing-space-components')
  assert.deepEqual(plugin.inject, ['tools'])
  assert.equal(typeof plugin.apply, 'function')
})

test('re-exports the pure resolver and extractor', () => {
  assert.equal(typeof plugin.resolveComponents, 'function')
  assert.equal(typeof plugin.resolveComponentsFromSpace, 'function')
  assert.equal(typeof plugin.extractPropsSchema, 'function')
})

test('mounts nothing for an agent that declares no components', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'fetcher' })
  assert.deepEqual(ctx.registered, [])
})

test('registers exactly one `display` tool whose component enum holds the declared names', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })

  assert.equal(ctx.registered.length, 1)
  const tool = ctx.registered[0]
  assert.equal(tool.name, 'display')
  // defineTool compiles the author-facing spec to raw JSON Schema.
  assert.deepEqual(tool.parameters.properties.component.enum, ['ArticlePreview'])
  assert.deepEqual(tool.parameters.required, ['component'])
  // The extracted per-component prop types are surfaced in the description so
  // the model sees them even though they cannot be a static schema constraint.
  assert.match(tool.description, /ArticlePreview \(view\): title: string, summary\?: string, tags\?: string\[\]/)
})

test('execute returns the canonical {component, kind, props, warnings} value', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  const value = await tool.execute(
    { component: 'ArticlePreview', props: { title: 'Widget X ships', tags: ['ai'] } },
    {},
  )
  assert.deepEqual(value, {
    component: 'ArticlePreview',
    kind: 'view',
    props: { title: 'Widget X ships', tags: ['ai'] },
    warnings: [],
  })
})

test('omitted props become {} — the canonical value must be lossless JSON', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  const value = await tool.execute({ component: 'ArticlePreview' }, {})
  assert.deepEqual(value.props, {})
  // `title` is required by the extracted schema, so the omission is reported as
  // a warning rather than an error.
  assert.equal(value.warnings.length, 1)
  assert.match(value.warnings[0], /ArticlePreview props/)
})

test('a props-shape mismatch is a visible warning, never a tool error', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  const value = await tool.execute(
    { component: 'ArticlePreview', props: { title: 42, tags: 'not-an-array' } },
    {},
  )
  assert.equal(value.component, 'ArticlePreview')
  assert.deepEqual(value.props, { title: 42, tags: 'not-an-array' })
  assert.ok(value.warnings.length >= 2, `expected warnings, got ${JSON.stringify(value.warnings)}`)
  for (const warning of value.warnings) assert.match(warning, /^ArticlePreview props: /)
})

test('extra props beyond the extracted schema are accepted without warning (open root)', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  const value = await tool.execute(
    { component: 'ArticlePreview', props: { title: 'ok', imageUrl: 'https://example.test/a.png' } },
    {},
  )
  assert.deepEqual(value.warnings, [])
})

test('the tool argument schema rejects a component outside the enum before execute runs', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  await assert.rejects(() => tool.execute({ component: 'NotAComponent', props: {} }, {}))
})

test('output.render and the presenters project the component name and pretty props', async () => {
  const ctx = stubCtx()
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'synthesizer' })
  const tool = ctx.registered[0]

  const args = { component: 'ArticlePreview', props: { title: 'ok' } }
  const value = { component: 'ArticlePreview', kind: 'view', props: { title: 'ok' }, warnings: ['w'] }

  const blocks = tool.output.render(args, value)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'text')
  assert.match(blocks[0].text, /Displaying view component "ArticlePreview"/)
  assert.match(blocks[0].text, /"title": "ok"/) // pretty-printed
  assert.match(blocks[0].text, /Prop warnings:\n- w/)

  assert.deepEqual(tool.presentCall(args), {
    card: 'generic',
    title: 'display ArticlePreview',
    kind: 'other',
    rawInput: { title: 'ok' },
  })
  assert.deepEqual(tool.presentResult(args, { content: blocks, isError: false }), {
    card: 'generic',
    title: 'display ArticlePreview',
    content: blocks,
  })
})

test('a component whose props do not statically extract falls back to open props', async () => {
  // The researcher's ResearchPreview DOES extract, so this pins the fallback
  // path with a synthetic space instead: a named-interface-typed component.
  const ctx = stubCtx()
  const { resolveComponentsFromSpace } = plugin
  const space = {
    dir: NEWSROOM_DIR,
    agents: { r: { slug: 'r', config: { components: ['Opaque'] } } },
    components: {
      view: { Opaque: 'interface P { a: string }\nexport function Opaque(props: P) { return null }' },
      form: {},
    },
  }
  // Sanity: the resolver sees it, the extractor declines it.
  const [component] = resolveComponentsFromSpace(space, 'r')
  assert.equal(plugin.extractPropsSchema(component.source, 'Opaque'), null)

  // And the researcher's real, extracting component still describes its props.
  await plugin.apply(ctx, { spaceDir: NEWSROOM_DIR, agentSlug: 'researcher' })
  assert.match(ctx.registered[0].description, /ResearchPreview \(view\): topic: string/)
})

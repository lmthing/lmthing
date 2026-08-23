import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSpace } from '@lmthing/dsh-space-format'
import { renderKnowledgeTree, scopeKnowledgeTree, summarizeDescription } from '../src/tree.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const SLACK_DIR = join(repoRoot, 'store', 'spaces', 'integration-slack')
const DEMO_DIR = join(here, '..', '..', '..', 'system-spaces', 'system-knowledge-demo')

const slack = await loadSpace(SLACK_DIR)
const demo = await loadSpace(DEMO_DIR)

test('renderKnowledgeTree: the slack fixture, scoped to the ref its own agent declares', () => {
  const text = renderKnowledgeTree(slack.knowledge.domains, ['slack/api'])
  assert.match(text, /^## Knowledge available to you$/m)
  assert.match(text, /^- \*\*slack\*\*$/m, 'the domain has no index.md, so no description suffix')
  assert.match(text, /^ {2}- \*\*api\*\* — The agent talks to the Slack Web API/m)
  assert.match(text, /^ {4}- auth$/m)
  assert.match(text, /^ {4}- endpoints$/m)
  assert.match(text, /loadKnowledge/, 'the section tells the model how to fetch a leaf')
})

test('renderKnowledgeTree: the field description is summarized to one line, not pasted whole', () => {
  const text = renderKnowledgeTree(slack.knowledge.domains, ['slack/api'])
  const line = text.split('\n').find((l) => l.includes('**api**'))
  assert.ok(line.length < 320, `the api line should be one summarized line, got ${line.length} chars`)
  // The source description is a ~20-line markdown cheat-sheet; its own heading
  // must not surface and the bullet list below it must not either.
  assert.equal(text.includes('# Slack Web API cheat-sheet'), false)
  assert.equal(text.includes('/conversations.list'), false)
  assert.equal(slack.knowledge.domains.slack.fields.api.description.includes('/conversations.list'), true)
})

test('renderKnowledgeTree: [] refs render nothing', () => {
  assert.equal(renderKnowledgeTree(slack.knowledge.domains, []), '')
  assert.equal(renderKnowledgeTree(demo.knowledge.domains, []), '')
})

test('renderKnowledgeTree: refs that match no real domain render nothing', () => {
  assert.equal(renderKnowledgeTree(demo.knowledge.domains, ['nope', 'nope/also']), '')
})

test('renderKnowledgeTree: the demo librarian sees brewing/method + all of service, never brewing/grind', () => {
  const text = renderKnowledgeTree(demo.knowledge.domains, demo.agents.librarian.config.knowledge)

  assert.match(text, /^- \*\*brewing\*\* — How the bar brews\./m)
  assert.match(text, /^ {2}- \*\*method\*\* \(type: 'pourover' \| 'espresso' \| 'cold-brew', default: pourover\)/m)
  assert.match(text, /^ {4}- pourover — The house filter method — 18 g to 300 g water at 94 °C over 3 minutes\.$/m)
  assert.match(text, /^ {4}- espresso — The bar's espresso recipe/m)
  assert.match(text, /^ {4}- cold-brew$/m, 'an option with no frontmatter renders as a bare slug')

  assert.match(text, /^- \*\*service\*\* — When the bar is open/m)
  assert.match(text, /^ {2}- \*\*hours\*\* — Split by the part of the week/m)
  assert.match(text, /^ {4}- weekday — Monday to Friday, 07:00–17:00/m)

  // The sibling field the librarian did NOT declare must be entirely absent.
  // (Substring checks false-positive here: the brewing domain description
  // itself says "the **grind** the method needs", bold markers and all — so
  // assert on the rendered LINES, which is what visibility actually means.)
  const lines = text.split('\n')
  assert.equal(lines.some((l) => /^ {2}- \*\*grind\*\*/.test(l)), false)
  assert.equal(lines.some((l) => /^ {4}- (coarse|fine)/.test(l)), false)
  assert.equal(text.includes('Setting 24'), false)
})

test('renderKnowledgeTree: a field whose type is the default is not annotated with it', () => {
  const text = renderKnowledgeTree(demo.knowledge.domains, ['service'])
  const line = text.split('\n').find((l) => l.includes('**hours**'))
  assert.equal(line.includes('type: string'), false, 'the default type is noise in a listing')
})

test('renderKnowledgeTree: an option-level ref hides its siblings but keeps its ancestors visible', () => {
  const text = renderKnowledgeTree(demo.knowledge.domains, ['brewing/method/espresso'])
  assert.match(text, /^- \*\*brewing\*\*/m)
  assert.match(text, /^ {2}- \*\*method\*\*/m)
  assert.match(text, /^ {4}- espresso/m)
  // The two sibling options must have no LINE of their own (both names still
  // appear inside the field's own `type:` annotation, which is real metadata).
  const optionLines = text.split('\n').filter((l) => /^ {4}- /.test(l))
  assert.deepEqual(optionLines.map((l) => l.trim().slice(2).split(' ')[0]), ['espresso'])
})

test('scopeKnowledgeTree: projects exactly the visible slice, in loaded order', () => {
  const scoped = scopeKnowledgeTree(demo.knowledge.domains, ['brewing/method', 'service'])
  assert.deepEqual(scoped.map((d) => d.slug), ['brewing', 'service'])
  assert.deepEqual(scoped[0].fields.map((f) => f.slug), ['method'])
  assert.deepEqual(scoped[0].fields[0].options.map((o) => o.slug), ['cold-brew', 'espresso', 'pourover'])
  assert.equal(scoped[0].fields[0].default, 'pourover')
  assert.deepEqual(scoped[1].fields.map((f) => f.slug), ['hours'])
})

test('scopeKnowledgeTree: a domain-only ref keeps a field that has no allowed options of its own', () => {
  // Prefix logic: 'service' allows ['service','hours'] directly, so the field
  // survives on its own merit rather than only via its options.
  const scoped = scopeKnowledgeTree({ service: { slug: 'service', fields: { hours: { slug: 'hours', type: 'string', options: {} } } } }, ['service'])
  assert.deepEqual(scoped.map((d) => d.slug), ['service'])
  assert.deepEqual(scoped[0].fields.map((f) => f.slug), ['hours'])
})

test('scopeKnowledgeTree: an empty domain matched by its own ref still renders (as a header line)', () => {
  const scoped = scopeKnowledgeTree({ empty: { slug: 'empty', fields: {} } }, ['empty'])
  assert.deepEqual(scoped, [{ slug: 'empty', fields: [] }])
  assert.match(renderKnowledgeTree({ empty: { slug: 'empty', fields: {} } }, ['empty']), /- \*\*empty\*\*/)
})

test('summarizeDescription: takes the first paragraph, skipping a leading heading', () => {
  assert.equal(summarizeDescription('# Title\n\nFirst line.\nSecond line.\n\nA later paragraph.'), 'First line. Second line.')
})

test('summarizeDescription: collapses whitespace and drops later paragraphs', () => {
  assert.equal(summarizeDescription('one\n   two\t\tthree\n\nfour'), 'one two three')
})

test('summarizeDescription: truncates at the last sentence boundary that fits', () => {
  const text = `${'A'.repeat(60)}. ${'B'.repeat(300)}`
  assert.equal(summarizeDescription(text), `${'A'.repeat(60)}.`)
})

test('summarizeDescription: a too-short sentence boundary falls back to a word cut, not a 4-char summary', () => {
  const summary = summarizeDescription(`e.g. ${'word '.repeat(80)}end`)
  assert.ok(summary.startsWith('e.g. word word'), summary)
  assert.ok(summary.endsWith('…'))
})

test('summarizeDescription: falls back to a word boundary + ellipsis with no sentence to cut at', () => {
  const summary = summarizeDescription(`${'word '.repeat(80)}end`)
  assert.ok(summary.endsWith('…'))
  assert.ok(summary.length <= 201, summary.length)
  assert.equal(summary.includes('  '), false)
})

test('summarizeDescription: a heading-only description falls back to the heading text', () => {
  assert.equal(summarizeDescription('# Just a heading\n'), 'Just a heading')
})

test('summarizeDescription: empty / non-string input is empty', () => {
  assert.equal(summarizeDescription(undefined), '')
  assert.equal(summarizeDescription(''), '')
  assert.equal(summarizeDescription('   \n\n  '), '')
  assert.equal(summarizeDescription(42), '')
})

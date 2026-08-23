import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePersonaText, buildPersonaText } from '../src/resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const USER_THING_DIR = join(__dirname, '../../../system-spaces/user-thing')

test('resolvePersonaText joins charter + instruct bodies for a real ported agent', async () => {
  const text = await resolvePersonaText(USER_THING_DIR, 'thing')
  assert.match(text, /Agent Instructions/)
  assert.match(text, /Routing/)
})

test('resolvePersonaText throws for an unknown agent', async () => {
  await assert.rejects(
    () => resolvePersonaText(USER_THING_DIR, 'does-not-exist'),
    /agent "does-not-exist" not found/,
  )
})

test('buildPersonaText rejects a literal "{{"', () => {
  assert.throws(
    () => buildPersonaText({ charterBody: 'hi {{name}}', instructBody: '' }),
    /literal "\{\{"/,
  )
})

test('buildPersonaText joins non-empty bodies with a blank line', () => {
  assert.equal(buildPersonaText({ charterBody: 'A', instructBody: 'B' }), 'A\n\nB')
  assert.equal(buildPersonaText({ charterBody: '', instructBody: 'B' }), 'B')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveFunctionTools } from '../src/resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const USER_THING_DIR = join(__dirname, '../../../system-spaces/user-thing')

test('resolveFunctionTools resolves every function thing declares to a real file', async () => {
  const tools = await resolveFunctionTools(USER_THING_DIR, 'thing')
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['forget', 'recall', 'recallAll', 'remember'],
  )
  for (const tool of tools) {
    assert.ok(tool.file.endsWith(`${tool.name}.js`), `${tool.name} resolves to a .js file`)
  }
})

test('resolveFunctionTools throws for an unknown agent', async () => {
  await assert.rejects(
    () => resolveFunctionTools(USER_THING_DIR, 'does-not-exist'),
    /agent "does-not-exist" not found/,
  )
})

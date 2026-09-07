import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'

/**
 * Shape-only, matching this track's established convention for thin client plugins (see e.g.
 * `space/test/index.test.js`): a synthetic boot harness cannot exercise JSX/real DOM rendering
 * meaningfully, so the actual rendering logic (`src/client.jsx`) is verified LIVE instead — Part A4
 * (see dsh/PROGRESS.md) records a real browser session (chrome-devtools MCP) confirming genuine
 * DOM output (`<p class="text-sm text-foreground">`, matching EchoCard.tsx's real JSX exactly) from
 * a server-bundled, dynamically `import()`ed component sharing the shell's own React instance.
 *
 * This test only pins the HOST half's shape: a real Cordis `Plugin.Object`, and — per its own doc
 * comment — genuinely empty, since all real behavior ships via `exports['./client']`.
 */
test('exports a valid Cordis Plugin.Object shape', () => {
  assert.equal(plugin.name, 'lmthing-client-space-components')
  assert.equal(typeof plugin.apply, 'function')
})

test('apply() is a true no-op — every real behavior lives in the client bundle, not here', () => {
  // No ctx at all is passed; a real host-side effect would throw reaching into it.
  assert.doesNotThrow(() => plugin.apply())
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'

/**
 * Shape-only, consistent with this family's convention: a thin `apply(ctx,
 * config)` wrapper is verified against REAL Cordis wiring live (a booted
 * profile), not through a synthetic boot harness. See dsh/packages/README.md.
 */
test('the module exports a valid Plugin.Object shape', () => {
  assert.equal(plugin.name, 'lmthing-space-knowledge')
  assert.deepEqual(plugin.inject, ['systemPrompt', 'tools'])
  assert.equal(typeof plugin.apply, 'function')
})

test('apply is async — whatever mounts it must await ctx.plugin()', () => {
  // The family's hardest-won convention: an unawaited ctx.plugin() lets the
  // parent's apply() return before an async child registers, and the
  // registration silently misses the first request's snapshot.
  assert.equal(plugin.apply.constructor.name, 'AsyncFunction')
})

test('the pure helpers are re-exported for reuse and testing', () => {
  for (const key of ['resolveKnowledge', 'isPathAllowed', 'resolveKnowledgeScoped', 'renderKnowledgeTree', 'scopeKnowledgeTree', 'summarizeDescription']) {
    assert.equal(typeof plugin[key], 'function', `expected ${key} to be exported`)
  }
})

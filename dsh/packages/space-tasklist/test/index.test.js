import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'

/**
 * Thin `apply(ctx, config)` plugin wrappers are NOT unit-tested through a
 * synthetic Cordis-boot harness in this track — real wiring is verified live
 * (see dsh/packages/README.md). What's asserted here is the `Plugin.Object`
 * shape a profile row needs, plus the injections this plugin genuinely
 * requires: `tools` to register with, and `workflowEngine` to start runs on
 * (provided by @deepseek-ai/dsh-workflow-worker-thread, already mounted by
 * @deepseek-ai/dsh-base's own default patch).
 */
test('exports a valid Cordis Plugin.Object shape', () => {
  assert.equal(typeof plugin.name, 'string')
  assert.equal(plugin.name, 'lmthing-space-tasklist')
  assert.equal(typeof plugin.apply, 'function')
  assert.ok(Array.isArray(plugin.inject))
  assert.deepEqual([...plugin.inject].sort(), ['tools', 'workflowEngine'])
})

test('re-exports the compiler, the loader and the condition DSL', () => {
  for (const name of [
    'compileTasklistToWorkflowScript',
    'validateTask',
    'mergedDependencies',
    'topologicalOrder',
    'outputObjectSchema',
    'loadTasklist',
    'loadTasklistFromSpace',
    'extractCodeNodeMeta',
    'evaluateCondition',
    'referencedTaskIds',
    'resolveTasklistTools',
    'parameterSchemaFromInput',
    'actionToolName',
  ]) {
    assert.equal(typeof plugin[name], 'function', `${name} is exported`)
  }
})

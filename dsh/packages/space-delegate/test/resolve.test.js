import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDelegateTargets, resolveDelegateMounts } from '../src/resolve.js'

const thing = { slug: 'thing', canDelegateTo: ['echo'], config: { functions: [] }, charterBody: 'THING', instructBody: 'Route.' }
const echo = { slug: 'echo', config: { functions: ['echoBack'] }, charterBody: 'An echo specialist.', instructBody: 'Echo the input.' }
const bystander = { slug: 'bystander', config: { functions: [] }, charterBody: '', instructBody: '' }

// Cross-space registry: each entry carries its OWN spaceDir, matching the
// real THING-delegates-to-a-different-space situation.
const registry = {
  thing: { agent: thing, spaceDir: '/user-thing' },
  echo: { agent: echo, spaceDir: '/system-echo' },
  bystander: { agent: bystander, spaceDir: '/system-bystander' },
}

test('resolveDelegateTargets: explicit allowlist restricts to named + existing agents', () => {
  assert.deepEqual(resolveDelegateTargets(thing, registry), ['echo'])
})

test('resolveDelegateTargets: omitted canDelegateTo means unrestricted (every other agent)', () => {
  const unrestricted = { slug: 'x' }
  assert.deepEqual(resolveDelegateTargets(unrestricted, { x: { agent: unrestricted, spaceDir: '/x' }, ...registry }).sort(), ['bystander', 'echo', 'thing'])
})

test('resolveDelegateTargets: empty list means no delegation', () => {
  const none = { slug: 'x', canDelegateTo: [] }
  assert.deepEqual(resolveDelegateTargets(none, { x: { agent: none, spaceDir: '/x' }, ...registry }), [])
})

test('resolveDelegateMounts: one mount per target, functionsConfig using the TARGET\'s own spaceDir, narrowed toolFilter', () => {
  const mounts = resolveDelegateMounts(thing, registry)
  assert.equal(mounts.length, 1)

  const [mount] = mounts
  assert.equal(mount.slug, 'echo')
  assert.deepEqual(mount.functionsConfig, { spaceDir: '/system-echo', agentSlug: 'echo' })
  assert.equal(mount.subagentConfig.provider, 'spawn')
  assert.equal(mount.subagentConfig.toolName, 'delegate_echo')
  assert.deepEqual(mount.subagentConfig.toolFilter, { allow: ['echoBack'] })
  assert.match(mount.subagentConfig.persona, /echo specialist/)
})

test('resolveDelegateMounts: a target with no functions gets no toolFilter and no functionsConfig (unnarrowed, not muted)', () => {
  const delegatesToBystander = { slug: 'x', canDelegateTo: ['bystander'] }
  const mounts = resolveDelegateMounts(delegatesToBystander, { x: { agent: delegatesToBystander, spaceDir: '/x' }, ...registry })
  assert.equal(mounts.length, 1)
  assert.equal(mounts[0].functionsConfig, null)
  assert.equal(mounts[0].subagentConfig.toolFilter, undefined)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { generatePresetRoster } from '../src/index.js'

test('generatePresetRoster: writes one agent.cordis.yml per agent, mounting @lmthing/dsh-space', async () => {
  const rosterDir = await mkdtemp(join(tmpdir(), 'preset-roster-'))
  try {
    await generatePresetRoster(rosterDir, {
      thing: { spaceDir: '/user-thing', agentSlug: 'thing' },
      echo: { spaceDir: '/system-echo', agentSlug: 'echo' },
    })

    const thingComposition = parse(await readFile(join(rosterDir, 'thing', 'agent.cordis.yml'), 'utf8'))
    assert.equal(thingComposition.length, 1)
    assert.equal(thingComposition[0].name, '@lmthing/dsh-space')
    assert.deepEqual(thingComposition[0].config, { spaceDir: '/user-thing', agentSlug: 'thing', registry: {} })
  } finally {
    await rm(rosterDir, { recursive: true, force: true })
  }
})

test('generatePresetRoster: includes the FULL registry in every generated preset (Part A2 regression — a real bug this port hit: an omitted registry silently mounts zero delegate_* tools, no thrown error anywhere)', async () => {
  const rosterDir = await mkdtemp(join(tmpdir(), 'preset-roster-'))
  try {
    const thing = { slug: 'thing', canDelegateTo: ['echo'] }
    const echo = { slug: 'echo' }
    const registry = {
      thing: { agent: thing, spaceDir: '/user-thing' },
      echo: { agent: echo, spaceDir: '/system-echo' },
    }

    await generatePresetRoster(
      rosterDir,
      { thing: { spaceDir: '/user-thing', agentSlug: 'thing' }, echo: { spaceDir: '/system-echo', agentSlug: 'echo' } },
      registry,
    )

    for (const slug of ['thing', 'echo']) {
      const composition = parse(await readFile(join(rosterDir, slug, 'agent.cordis.yml'), 'utf8'))
      assert.deepEqual(
        Object.keys(composition[0].config.registry).sort(),
        ['echo', 'thing'],
        `preset "${slug}" must receive the full delegation registry, not an empty one`,
      )
    }
  } finally {
    await rm(rosterDir, { recursive: true, force: true })
  }
})

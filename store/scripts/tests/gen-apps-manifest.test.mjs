/**
 * Tests for the store catalog manifest generator's S12 enrichment
 * (`scripts/gen-apps-manifest.mjs`).
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test 'store/scripts/tests/*.test.mjs'
 *
 * - **Happy path**: `buildManifest()` over the real `store/spaces/` lifts the
 *   `integration-lmthing` space's `events`/`functions`/`agents` into its catalog
 *   entry (the fields `system-store` fit-checks an install against).
 * - **Fail-loud**: a MALFORMED emitter def in a fixture space FAILS the build
 *   (throws) — the store never publishes an invalid producer contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildManifest } from '../gen-apps-manifest.mjs';

test('integration-lmthing catalog entry carries its lifted events/functions/agents', async () => {
  const manifest = await buildManifest();
  const space = manifest.spaces.find((s) => s.id === 'integration-lmthing');
  assert.ok(space, 'integration-lmthing not found in the generated manifest');

  // events — the union of the 5 internal emitter defs.
  assert.ok(space.events, 'entry has no `events`');
  assert.deepEqual(
    space.events['session.completed'],
    { payload: { projectId: 'string', agent: 'string', sessionId: 'string', ok: 'boolean', durationMs: 'number' } },
  );
  for (const ev of ['space.installed', 'hook.fired', 'document.written', 'project.created']) {
    assert.ok(space.events[ev], `missing event ${ev}`);
  }

  // functions — publishEvent, with a lifted signature.
  const publish = space.functions.find((f) => f.name === 'publishEvent');
  assert.ok(publish, 'publishEvent not lifted');
  assert.match(publish.signature ?? '', /publishEvent\(/);

  // agents — the publisher agent with its declared actions.
  const publisher = space.agents.find((a) => a.slug === 'publisher');
  assert.ok(publisher, 'publisher agent not lifted');
  assert.deepEqual(publisher.actions, ['publish', 'explain']);

  // No webhook defs → no inbound.
  assert.deepEqual(space.inbound, []);
});

test('a malformed emitter def fails the store build loudly', async () => {
  const emptyApps = await mkdtemp(join(tmpdir(), 'gen-apps-empty-'));
  const spaces = await mkdtemp(join(tmpdir(), 'gen-apps-spaces-'));
  const bad = join(spaces, 'integration-bad');
  await mkdir(join(bad, 'events'), { recursive: true });
  await writeFile(
    join(bad, 'package.json'),
    JSON.stringify({ name: 'integration-bad', lmthing: { kind: 'integration', title: 'Bad' } }),
  );
  // `count: 'int'` is not a valid typeString (string|number|boolean|object|array|any).
  await writeFile(
    join(bad, 'events', 'broken.ts'),
    [
      'const def = {',
      "  type: 'internal',",
      "  on: { signal: 'x.happened' },",
      "  emits: { 'x.happened': { payload: { count: 'int' } } },",
      '  emit() { return []; },',
      '};',
      'export default def;',
      '',
    ].join('\n'),
  );

  try {
    await assert.rejects(
      () => buildManifest(emptyApps, spaces),
      /invalid typeString/,
      'a malformed emitter def should fail the build',
    );
  } finally {
    await rm(emptyApps, { recursive: true, force: true });
    await rm(spaces, { recursive: true, force: true });
  }
});

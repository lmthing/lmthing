/**
 * Emitter unit tests for the `integration-lmthing` space.
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test 'store/spaces/integration-lmthing/tests/*.test.mjs'
 *
 * Each `events/*.ts` internal emitter def is transpiled (via `typescript`, a
 * store devDependency) and imported, then:
 *   - validated with the REAL engine validator (`validateEmitterDef` from the
 *     built `@lmthing/core` in the sdk/org submodule) — the same fail-loud check
 *     the store gen script and the pod's emitter scanner apply;
 *   - exercised: `emit({ name, data })` maps the S8 signal payload to the typed
 *     event, and returns `[]` when a contracted field is missing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACE = join(HERE, '..'); // store/spaces/integration-lmthing
const EVENTS = join(SPACE, 'events');
const REPO = join(SPACE, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

/** Transpile one `events/<name>.ts` and import its default export. */
async function importDef(name) {
  const ts = (await import('typescript')).default;
  const src = await readFile(join(EVENTS, `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  });
  const tmp = join(tmpdir(), `lmthing-emitter-${randomUUID()}.mjs`);
  await writeFile(tmp, outputText, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href)).default;
  } finally {
    await rm(tmp, { force: true });
  }
}

test('every events/*.ts def passes the engine validateEmitterDef', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateEmitterDef } = await import(CORE);
  for (const name of [
    'session-completed',
    'space-installed',
    'hook-fired',
    'document-written',
    'project-created',
  ]) {
    const def = await importDef(name);
    const validated = validateEmitterDef(def, `${name}.ts`);
    assert.equal(validated.type, 'internal');
  }
});

test('space.installed maps a signal to the typed event, and drops incomplete signals', async () => {
  const def = await importDef('space-installed');
  assert.equal(def.on.signal, 'space.installed');
  assert.deepEqual(
    def.emit({ name: 'space.installed', data: { projectId: 'p', spaceId: 's' } }),
    [{ event: 'space.installed', payload: { projectId: 'p', spaceId: 's' } }],
  );
  // Missing spaceId (the signal carries it optionally) → no event.
  assert.deepEqual(def.emit({ name: 'space.installed', data: { projectId: 'p' } }), []);
});

test('session.completed maps the full S8 payload and drops incomplete signals', async () => {
  const def = await importDef('session-completed');
  assert.deepEqual(
    def.emit({
      name: 'session.completed',
      data: { projectId: 'p', agent: 'thing', sessionId: 'sid', ok: true, durationMs: 1200, extra: 'ignored' },
    }),
    [{ event: 'session.completed', payload: { projectId: 'p', agent: 'thing', sessionId: 'sid', ok: true, durationMs: 1200 } }],
  );
  assert.deepEqual(def.emit({ name: 'session.completed', data: { projectId: 'p', agent: 'thing' } }), []);
});

test('hook.fired / document.written / project.created map their payloads', async () => {
  const hook = await importDef('hook-fired');
  assert.deepEqual(
    hook.emit({ name: 'hook.fired', data: { projectId: 'p', slug: 'sl', hookType: 'event' } }),
    [{ event: 'hook.fired', payload: { projectId: 'p', slug: 'sl', hookType: 'event' } }],
  );
  const doc = await importDef('document-written');
  assert.deepEqual(
    doc.emit({ name: 'document.written', data: { projectId: 'p', path: 'notes/a.md' } }),
    [{ event: 'document.written', payload: { projectId: 'p', path: 'notes/a.md' } }],
  );
  const proj = await importDef('project-created');
  assert.deepEqual(
    proj.emit({ name: 'project.created', data: { projectId: 'p' } }),
    [{ event: 'project.created', payload: { projectId: 'p' } }],
  );
  assert.deepEqual(proj.emit({ name: 'project.created', data: {} }), []);
});

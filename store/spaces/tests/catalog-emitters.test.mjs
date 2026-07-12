/**
 * Catalog-wide emitter guard.
 *
 * The per-space tests check that a def, once written, is CORRECT. Nothing checked that a space
 * that needs a def actually HAS one — which is how `integration-demo` came out of the events
 * migration (S15) with its inbound half stranded on the legacy `lmthing.webhook` descriptor and
 * no `events/` def at all: it validated fine, because there was nothing to validate. The demo
 * space is precisely the one the live scenarios use to inject inbound events, so the gap was
 * invisible until something tried to use it.
 *
 * This test is the guard for the whole catalog:
 *
 *   1. No space may still carry the LEGACY `lmthing.webhook` block. A space must declare its
 *      inbound half as an `events/*.ts` webhook emitter def; carrying both would let the legacy
 *      binding shadow the def.
 *   2. Every `messaging` space must expose an inbound producer — a webhook emitter def emitting
 *      `message.received`. A messaging integration you cannot receive from is a broken product.
 *   3. Every `events/*.ts` in every space passes the REAL engine validator, and space defs keep
 *      their env refs inside their own `INTEGRATION_<ID>_` namespace (containment).
 *
 * Run: node --test 'store/spaces/tests/*.test.mjs'   (also `pnpm -C store test:spaces`)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACES = join(HERE, '..'); // store/spaces
const REPO = join(SPACES, '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

/** Every `integration-*` space in the catalog, with its parsed `lmthing` manifest block. */
async function catalog() {
  const dirs = (await readdir(SPACES, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith('integration-'))
    .map((d) => d.name);
  const out = [];
  for (const id of dirs) {
    const pkg = JSON.parse(await readFile(join(SPACES, id, 'package.json'), 'utf8'));
    const eventsDir = join(SPACES, id, 'events');
    const events = existsSync(eventsDir)
      ? (await readdir(eventsDir)).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''))
      : [];
    out.push({ id, pkg, lmthing: pkg.lmthing ?? {}, events });
  }
  return out;
}

/** Transpile one `<space>/events/<name>.ts` and import its default export. */
async function importDef(spaceId, name) {
  const ts = (await import('typescript')).default;
  const src = await readFile(join(SPACES, spaceId, 'events', `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    fileName: `${name}.ts`,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  });
  const tmp = join(tmpdir(), `lmthing-emitter-${randomUUID()}.mjs`);
  await writeFile(tmp, outputText, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href)).default;
  } finally {
    await rm(tmp, { force: true });
  }
}

test('no space carries the legacy lmthing.webhook descriptor block', async () => {
  const stale = (await catalog()).filter((s) => s.lmthing.webhook).map((s) => s.id);
  assert.deepEqual(
    stale,
    [],
    `these spaces still declare the LEGACY package.json "lmthing.webhook" block — move the inbound ` +
      `half to an events/*.ts webhook emitter def (see integration-telegram): ${stale.join(', ')}`,
  );
});

test('every messaging space has a webhook emitter def emitting message.received', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateEmitterDef } = await import(CORE);

  const messaging = (await catalog()).filter((s) => (s.lmthing.tags ?? []).includes('messaging'));
  assert.ok(messaging.length > 0, 'no messaging spaces found — the catalog scan is broken');

  for (const space of messaging) {
    assert.ok(
      space.events.length > 0,
      `${space.id} is tagged "messaging" but has no events/ emitter def — it cannot receive anything`,
    );

    const defs = [];
    for (const name of space.events) defs.push(validateEmitterDef(await importDef(space.id, name), `${name}.ts`));

    const inbound = defs.filter((d) => d.type === 'webhook');
    assert.ok(
      inbound.length > 0,
      `${space.id} is tagged "messaging" but declares no webhook emitter def (inbound producer)`,
    );
    assert.ok(
      inbound.some((d) => Object.keys(d.emits).includes('message.received')),
      `${space.id}'s webhook def must emit "message.received" (the messaging contract) — ` +
        `got: ${inbound.flatMap((d) => Object.keys(d.emits)).join(', ')}`,
    );
  }
});

test('every space def validates and keeps its env refs inside its own INTEGRATION_<ID>_ namespace', async () => {
  const { validateEmitterDef } = await import(CORE);

  for (const space of await catalog()) {
    // e.g. integration-nextcloud-talk → INTEGRATION_NEXTCLOUD_TALK_
    const ns = `INTEGRATION_${space.id.replace(/^integration-/, '').replace(/-/g, '_').toUpperCase()}_`;

    for (const name of space.events) {
      const def = validateEmitterDef(await importDef(space.id, name), `${space.id}/events/${name}.ts`);

      // Containment: a def that names a secret can only name one in its OWN namespace, so store
      // code can never read system or other-space secrets. The `builtin` verify shorthand names
      // no env at all and is exempt.
      const refs = [def.secretEnv, def.challenge?.verifyTokenEnv].filter(Boolean);
      for (const ref of refs) {
        assert.ok(
          ref.startsWith(ns),
          `${space.id}/events/${name}.ts references env "${ref}" outside its namespace "${ns}"`,
        );
      }
    }
  }
});

test('integration-demo emits message.received from a signed payload, and filters the rest', async () => {
  const def = await importDef('integration-demo', 'messages');

  assert.equal(def.type, 'webhook');
  assert.equal(def.path, 'demo');
  assert.equal(def.verify.type, 'hmac');
  assert.equal(def.secretEnv, 'INTEGRATION_DEMO_WEBHOOK_SECRET');

  assert.deepEqual(
    def.emit({
      json: {
        message: {
          message_id: 7,
          text: 'hello',
          chat: { id: 'c1' },
          from: { id: 'u1', username: 'ada' },
        },
      },
    }),
    [
      {
        event: 'message.received',
        payload: {
          text: 'hello',
          from: 'u1',
          chatId: 'c1',
          userName: 'ada',
          raw: {
            message: {
              message_id: 7,
              text: 'hello',
              chat: { id: 'c1' },
              from: { id: 'u1', username: 'ada' },
            },
          },
        },
        threadKey: '7',
      },
    ],
  );

  // Filters: bot echoes, empty text, non-message payloads → no event, no agent wakes.
  assert.deepEqual(def.emit({ json: { message: { text: 'hi', chat: { id: 'c' }, from: { id: 'b', is_bot: true } } } }), []);
  assert.deepEqual(def.emit({ json: { message: { text: '', chat: { id: 'c' }, from: { id: 'u' } } } }), []);
  assert.deepEqual(def.emit({ json: { edited_message: { text: 'x' } } }), []);
  assert.deepEqual(def.emit({ json: null }), []);
});

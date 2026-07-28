/**
 * Shape guard for utility-intake's hooks. Unlike the other utility spaces this one ships an EVENT
 * hook (on its own table), not a cron — so the generic shape test also asserts the address form.
 *
 * Run: pnpm -C store test:spaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACE = join(HERE, '..');
const SPACE_ID = 'utility-intake';

async function importHook(name) {
  const ts = (await import('typescript')).default;
  const src = await readFile(join(SPACE, 'hooks', `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  });
  const tmp = join(tmpdir(), `lmthing-hook-${randomUUID()}.mjs`);
  await writeFile(tmp, outputText, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href)).default;
  } finally {
    await rm(tmp, { force: true });
  }
}

test('every hook has a valid shape and stays inside this space', async () => {
  const names = (await readdir(join(SPACE, 'hooks'))).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''));
  assert.ok(names.length > 0, 'utility-intake ships at least the triage hook');

  for (const name of names) {
    const hook = await importHook(name);
    assert.ok(hook && typeof hook === 'object', `${name}: default export must be an object`);
    assert.ok(['cron', 'event'].includes(hook.type), `${name}: type must be cron|event`);

    const hasHandler = typeof hook.handler === 'function';
    const hasTrigger = typeof hook.trigger === 'string';
    assert.ok(hasHandler !== hasTrigger, `${name}: exactly one of handler|trigger`);

    if (hasTrigger) {
      const m = hook.trigger.match(/^([a-z0-9-]+)\/([a-z0-9-]+)#([a-z0-9_-]+)$/);
      assert.ok(m, `${name}: trigger "${hook.trigger}" must be <space>/<agent>#<action>`);
      assert.equal(m[1], SPACE_ID, `${name}: a shipped hook may only trigger this space's own agent`);
    }

    if (hook.type === 'event') {
      // Source-qualified address: <sourceId>/<name>, dotted names allowed.
      assert.match(hook.on?.event ?? '', /^[a-z0-9-]+\/[a-z0-9._-]+$/i, `${name}: on.event must be source-qualified`);
    }

    if (hook.budget !== undefined) {
      const keys = Object.keys(hook.budget);
      assert.ok(keys.every((k) => ['maxEpisodes', 'maxWallClockMs'].includes(k)),
        `${name}: budget accepts only maxEpisodes/maxWallClockMs, got ${keys}`);
      for (const k of keys) assert.ok(Number.isFinite(hook.budget[k]) && hook.budget[k] >= 0, `${name}: budget.${k} must be >= 0`);
    }
  }
});

test('the triage hook listens to this space OWN table and is budget-bounded', async () => {
  const hook = await importHook('triage-on-insert');
  assert.equal(hook.type, 'event');
  // A shipped generic space may only hook a table it creates itself — it cannot know host tables.
  assert.equal(hook.on.event, 'project/db.intake_items.insert');
  assert.equal(hook.trigger, 'utility-intake/triager#triage');
  assert.ok(hook.budget?.maxEpisodes > 0 && hook.budget?.maxWallClockMs > 0, 'the triage hook must be budget-bounded');
});

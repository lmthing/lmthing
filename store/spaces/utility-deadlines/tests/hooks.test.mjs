/**
 * Shape guard for utility-deadlines' hooks — a bad trigger string or budget key ships silently
 * (space hooks are worker-loaded fail-soft), so the test is where it fails loudly.
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
const SPACE_ID = 'utility-deadlines';

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
  assert.ok(names.length > 0, 'utility-deadlines ships at least the daily sweep hook');

  for (const name of names) {
    const hook = await importHook(name);
    assert.ok(hook && typeof hook === 'object', `${name}: default export must be an object`);
    assert.ok(['cron', 'event'].includes(hook.type), `${name}: type must be cron|event`);

    const hasHandler = typeof hook.handler === 'function';
    const hasTrigger = typeof hook.trigger === 'string';
    assert.ok(hasHandler !== hasTrigger, `${name}: exactly one of handler|trigger`);

    if (hasTrigger) {
      // '<spaceId>/<agent>#<action>' — and it must target THIS space's own agent.
      const m = hook.trigger.match(/^([a-z0-9-]+)\/([a-z0-9-]+)#([a-z0-9_-]+)$/);
      assert.ok(m, `${name}: trigger "${hook.trigger}" must be <space>/<agent>#<action>`);
      assert.equal(m[1], SPACE_ID, `${name}: a shipped hook may only trigger this space's own agent`);
    }

    if (hook.type === 'cron') {
      assert.ok(/^\d{2}:\d{2}$/.test(hook.daily ?? '') || typeof hook.every === 'string',
        `${name}: cron hook needs daily "HH:MM" or every`);
    }

    if (hook.budget !== undefined) {
      const keys = Object.keys(hook.budget);
      assert.ok(keys.every((k) => ['maxEpisodes', 'maxWallClockMs'].includes(k)),
        `${name}: budget accepts only maxEpisodes/maxWallClockMs, got ${keys}`);
      for (const k of keys) assert.ok(Number.isFinite(hook.budget[k]) && hook.budget[k] >= 0, `${name}: budget.${k} must be >= 0`);
    }
  }
});

test('the daily sweep triggers the keeper sweep action with a bounded budget', async () => {
  const hook = await importHook('daily-sweep');
  assert.equal(hook.type, 'cron');
  assert.equal(hook.trigger, 'utility-deadlines/keeper#sweep');
  assert.ok(hook.budget?.maxEpisodes > 0 && hook.budget?.maxWallClockMs > 0, 'the cron sweep must be budget-bounded');
});

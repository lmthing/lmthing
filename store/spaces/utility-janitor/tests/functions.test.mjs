/**
 * Unit tests for utility-janitor's pure functions — no network, no LLM, no clock.
 *
 * Functions are transpiled standalone (same pattern as store/spaces/tests/catalog-emitters.test.mjs)
 * exactly the way the runtime injects them, so a cross-file import would fail here first.
 *
 * Run: pnpm -C store test:spaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

async function importFn(name) {
  const ts = (await import('typescript')).default;
  const src = await readFile(join(HERE, '..', 'functions', `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  });
  const tmp = join(tmpdir(), `lmthing-fn-${randomUUID()}.mjs`);
  await writeFile(tmp, outputText, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href))[name];
  } finally {
    await rm(tmp, { force: true });
  }
}

// ---------- findDuplicateGroups ----------

test('findDuplicateGroups: groups on normalized equality, only groups with >1 row', async () => {
  const dupes = await importFn('findDuplicateGroups');
  const rows = [
    { id: 1, name: '  Ada  Lovelace ' },
    { id: 2, name: 'ada lovelace' },
    { id: 3, name: 'Grace Hopper' },
    { id: 4, name: 'ADA LOVELACE' },
  ];
  const out = dupes(rows, ['name']);
  assert.equal(out.length, 1, 'only the Ada group duplicates');
  assert.equal(out[0].key, 'ada lovelace');
  assert.deepEqual(out[0].rowIds, ['1', '2', '4']);
});

test('findDuplicateGroups: composite keys, rows without id skipped, all-empty keys skipped', async () => {
  const dupes = await importFn('findDuplicateGroups');
  const out = dupes(
    [
      { id: 1, name: 'a', city: 'Athens' },
      { id: 2, name: 'a', city: 'Berlin' }, // different composite key → not a dupe
      { name: 'a', city: 'Athens' },        // no id → skipped, so no group forms
      { id: 4, name: '', city: '   ' },
      { id: 5, name: null, city: undefined }, // both empty → never grouped together
    ],
    ['name', 'city'],
  );
  assert.deepEqual(out, []);
});

test('findDuplicateGroups: malformed input degrades to []', async () => {
  const dupes = await importFn('findDuplicateGroups');
  assert.deepEqual(dupes(null, ['name']), []);
  assert.deepEqual(dupes([{ id: 1, name: 'a' }], null), []);
  assert.deepEqual(dupes([{ id: 1, name: 'a' }], []), []);
  assert.deepEqual(dupes([null, 42, 'nope', { id: 1, name: 'a' }], ['name']), []);
});

// ---------- normalizeCellValue ----------

test('normalizeCellValue: whitespace trims and collapses', async () => {
  const norm = await importFn('normalizeCellValue');
  assert.deepEqual(norm('whitespace', '  Ada   Lovelace \n'), { changed: true, value: 'Ada Lovelace' });
  assert.deepEqual(norm('whitespace', 'Ada Lovelace'), { changed: false, value: 'Ada Lovelace' });
});

test('normalizeCellValue: email lowercases only a valid email shape', async () => {
  const norm = await importFn('normalizeCellValue');
  assert.deepEqual(norm('email', '  Ada@Example.COM '), { changed: true, value: 'ada@example.com' });
  assert.deepEqual(norm('email', 'ada@example.com'), { changed: false, value: 'ada@example.com' });
  // Invalid shapes must be left EXACTLY alone — the janitor never guesses an address.
  for (const bad of ['Ada At Example', 'ada@example', 'ada@@example.com', 'ada @example.com', '', 'NOPE']) {
    assert.deepEqual(norm('email', bad), { changed: false, value: bad }, `must not touch ${JSON.stringify(bad)}`);
  }
});

test('normalizeCellValue: phone strips separators, keeps a leading +, respects the 7-15 digit band', async () => {
  const norm = await importFn('normalizeCellValue');
  assert.deepEqual(norm('phone', '+30 (210) 555-1234'), { changed: true, value: '+302105551234' });
  assert.deepEqual(norm('phone', '210.555.1234'), { changed: true, value: '2105551234' });
  assert.deepEqual(norm('phone', '+302105551234'), { changed: false, value: '+302105551234' });
  assert.deepEqual(norm('phone', '12-34'), { changed: false, value: '12-34' });                      // 4 digits, too short
  assert.deepEqual(norm('phone', '1234567890123456'), { changed: false, value: '1234567890123456' }); // 16, too long
  assert.deepEqual(norm('phone', '555-1234 ext 9'), { changed: false, value: '555-1234 ext 9' });     // not provably a number
});

test('normalizeCellValue: date canonicalizes to YYYY-MM-DD, refuses anything unparseable', async () => {
  const norm = await importFn('normalizeCellValue');
  assert.deepEqual(norm('date', '2026/07/26'), { changed: true, value: '2026-07-26' });
  assert.deepEqual(norm('date', '2026-07-26T14:30:00Z'), { changed: true, value: '2026-07-26' });
  assert.deepEqual(norm('date', '2026-07-26'), { changed: false, value: '2026-07-26' });
  assert.deepEqual(norm('date', 1753500000000), { changed: true, value: new Date(1753500000000).toISOString().slice(0, 10) });
  for (const bad of ['soonish', 'Report 12', '', 'TBD', 2026]) {
    assert.deepEqual(norm('date', bad), { changed: false, value: bad }, `must not touch ${JSON.stringify(bad)}`);
  }
});

test('normalizeCellValue: malformed input and unknown kinds never throw or change', async () => {
  const norm = await importFn('normalizeCellValue');
  for (const [kind, value] of [
    ['whitespace', null], ['email', undefined], ['phone', 42], ['whitespace', {}],
    ['bogus-kind', '  x  '], ['', 'x'], [null, 'x'],
  ]) {
    const r = norm(kind, value);
    assert.equal(r.changed, false);
    assert.equal(r.value, value);
  }
});

// ---------- findOrphanRows ----------

test('findOrphanRows: flags non-empty fks with no parent, ignores empty ones', async () => {
  const orphans = await importFn('findOrphanRows');
  const rows = [
    { id: 1, customer_id: '7' },
    { id: 2, customer_id: 99 },   // no parent 99
    { id: 3, customer_id: '' },   // unset relation, not an orphan
    { id: 4, customer_id: null },
    { customer_id: 99 },          // no row id → cannot be acted on
  ];
  const out = orphans(rows, 'customer_id', [7, '8']);
  assert.deepEqual(out, [{ rowId: '2', fkValue: '99' }]);
});

test('findOrphanRows: string/number ids compare equal; malformed input degrades to []', async () => {
  const orphans = await importFn('findOrphanRows');
  assert.deepEqual(orphans([{ id: 1, p_id: 42 }], 'p_id', ['42']), []);
  assert.deepEqual(orphans(null, 'p_id', [1]), []);
  assert.deepEqual(orphans([{ id: 1, p_id: 1 }], '', [1]), []);
  assert.deepEqual(orphans([null, 'nope', 7], 'p_id', [1]), []);
  // No parent ids at all → every non-empty fk is an orphan, and nothing throws.
  assert.deepEqual(orphans([{ id: 1, p_id: 5 }], 'p_id', null), [{ rowId: '1', fkValue: '5' }]);
});

// ---------- computeFindingKey ----------

test('computeFindingKey: stable, sanitized, and discriminating', async () => {
  const key = await importFn('computeFindingKey');
  assert.equal(key('customers', 42, 'normalize', 'email'), 'customers:42:normalize:email');
  // Stable across calls with equivalent input (whitespace/case are normalized away).
  assert.equal(key('customers', '42', 'normalize', ' Email '), key('customers', 42, 'normalize', 'email'));
  // Different column → different finding.
  assert.notEqual(key('customers', 42, 'normalize', 'phone'), key('customers', 42, 'normalize', 'email'));
  // Different kind on the same row → different finding.
  assert.notEqual(key('customers', 42, 'orphan', 'email'), key('customers', 42, 'normalize', 'email'));
  // Hostile inputs sanitize instead of throwing.
  assert.equal(typeof key(null, undefined, 'a:b c', ''), 'string');
});

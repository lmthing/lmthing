/**
 * Unit tests for utility-deadlines' pure functions — no network, no LLM, no clock.
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

// ---------- parseDateValue ----------

test('parseDateValue: accepts the shapes app tables actually hold', async () => {
  const parse = await importFn('parseDateValue');
  assert.equal(parse('2026-07-26'), '2026-07-26T00:00:00.000Z');
  assert.equal(parse('2026/07/26'), '2026-07-26T00:00:00.000Z');
  assert.equal(parse('2026-07-26T14:30:00Z'), '2026-07-26T14:30:00.000Z');
  assert.equal(parse('2026-07-26 14:30'), '2026-07-26T14:30:00.000Z');
  assert.equal(parse(1753500000000), new Date(1753500000000).toISOString()); // epoch ms
  assert.equal(parse(1753500000), new Date(1753500000000).toISOString()); // epoch s
  assert.equal(parse('1753500000'), new Date(1753500000000).toISOString()); // numeric string
});

test('parseDateValue: rejects non-dates without throwing', async () => {
  const parse = await importFn('parseDateValue');
  for (const bad of [null, undefined, '', '  ', 'Report 12', 'not a date', 42, 2026, {}, [], true, NaN, '12,5', '2026-13-45T99:99']) {
    assert.equal(parse(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// ---------- discoverDateColumns ----------

test('discoverDateColumns: finds date columns by name and by values, excludes bookkeeping', async () => {
  const discover = await importFn('discoverDateColumns');
  const tables = [
    { name: 'documents', columns: ['id', 'title', 'expiry_date', 'createdAt'] },
    { name: 'notes', columns: ['id', 'body'] },
  ];
  const samples = {
    documents: [
      { id: 1, title: 'passport', expiry_date: '2027-01-01', createdAt: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'lease', expiry_date: '2026-09-30', createdAt: '2026-01-02T00:00:00Z' },
    ],
    notes: [{ id: 1, body: 'hello' }],
  };
  const out = discover(tables, samples);
  const cols = out.map((c) => `${c.table}.${c.column}`);
  assert.ok(cols.includes('documents.expiry_date'), `expected expiry_date in ${cols}`);
  assert.ok(!cols.includes('documents.createdAt'), 'bookkeeping columns must be excluded');
  assert.ok(!cols.some((c) => c.startsWith('notes.')), 'no date-like columns in notes');
  const exp = out.find((c) => c.column === 'expiry_date');
  assert.ok(exp.confidence >= 0.8, `name+values should be high confidence, got ${exp.confidence}`);
});

test('discoverDateColumns: value-only signal (no name hint) still qualifies at high parse rate', async () => {
  const discover = await importFn('discoverDateColumns');
  const out = discover(
    [{ name: 't', columns: ['id', 'when_it_happens'] }],
    { t: [{ id: 1, when_it_happens: '2026-08-01' }, { id: 2, when_it_happens: '2026-08-02' }] },
  );
  assert.ok(out.some((c) => c.column === 'when_it_happens'));
});

test('discoverDateColumns: name hint with never-parsing values is rejected; empty table with hint is proposed', async () => {
  const discover = await importFn('discoverDateColumns');
  const out = discover(
    [
      { name: 'a', columns: ['due_label'] }, // date-ish name, prose values
      { name: 'b', columns: ['due_date'] }, // date-ish name, no rows at all
    ],
    { a: [{ due_label: 'soonish' }, { due_label: 'whenever' }], b: [] },
  );
  assert.ok(!out.some((c) => c.table === 'a'), 'never-parsing values must disqualify');
  assert.ok(out.some((c) => c.table === 'b'), 'empty table with a name hint stays a candidate');
});

test('discoverDateColumns: malformed input degrades to []', async () => {
  const discover = await importFn('discoverDateColumns');
  assert.deepEqual(discover(null, null), []);
  assert.deepEqual(discover('nope', undefined), []);
  assert.deepEqual(discover([{ bogus: true }, 42], {}), []);
});

// ---------- computeDueItems ----------

const NOW = '2026-07-26T12:00:00.000Z';

test('computeDueItems: windows are inclusive, sorted, and computed against the injected now', async () => {
  const compute = await importFn('computeDueItems');
  const rows = [
    { id: 1, name: 'due today', d: '2026-07-26' },
    { id: 2, name: 'in window', d: '2026-08-05' },
    { id: 3, name: 'beyond window', d: '2026-09-01' },
    { id: 4, name: 'yesterday (grace)', d: '2026-07-25' },
    { id: 5, name: 'long past', d: '2026-01-01' },
    { id: 6, name: 'unparseable', d: 'TBD' },
    { id: 7, name: 'empty', d: '' },
  ];
  const out = compute(rows, 'd', 14, NOW, 'name');
  assert.deepEqual(out.map((o) => o.rowId), ['4', '1', '2']);
  assert.equal(out.find((o) => o.rowId === '1').daysLeft, 0);
  assert.equal(out.find((o) => o.rowId === '4').daysLeft, -1);
  assert.equal(out.find((o) => o.rowId === '2').label, 'in window');
});

test('computeDueItems: rows without an id are skipped; label falls back sensibly', async () => {
  const compute = await importFn('computeDueItems');
  const out = compute(
    [{ d: '2026-07-27' }, { id: 9, d: '2026-07-27' }],
    'd', 14, NOW, null,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].rowId, '9');
  assert.equal(out[0].label, '9'); // no labelColumn, no name/title/label → id
});

test('computeDueItems: malformed input degrades to []', async () => {
  const compute = await importFn('computeDueItems');
  assert.deepEqual(compute(null, 'd', 14, NOW), []);
  assert.deepEqual(compute([{ id: 1, d: '2026-07-27' }], '', 14, NOW), []);
  assert.deepEqual(compute([{ id: 1, d: '2026-07-27' }], 'd', 14, 'not a date'), []);
});

// ---------- makeDedupeKey ----------

test('makeDedupeKey: stable, date-keyed, sanitized', async () => {
  const key = await importFn('makeDedupeKey');
  assert.equal(key('documents', 42, 'expiry_date', '2026-08-01T00:00:00.000Z'), 'documents:42:expiry_date:2026-08-01');
  // Same date, different time → same key (a re-sweep never duplicates).
  assert.equal(
    key('documents', 42, 'expiry_date', '2026-08-01T23:59:00.000Z'),
    key('documents', 42, 'expiry_date', '2026-08-01T00:00:00.000Z'),
  );
  // Moved deadline → different key.
  assert.notEqual(
    key('documents', 42, 'expiry_date', '2026-08-02'),
    key('documents', 42, 'expiry_date', '2026-08-01'),
  );
  // Hostile inputs sanitize instead of throwing.
  assert.equal(typeof key(null, undefined, 'a:b c', ''), 'string');
});

/**
 * Unit tests for utility-archivist's pure functions — no network, no LLM, no clock.
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

// ---------- buildTableSnapshot ----------

test('buildTableSnapshot: key order never changes the output', async () => {
  const snap = await importFn('buildTableSnapshot');
  const a = snap([{ id: 1, name: 'x', tags: ['b', 'a'] }]);
  const b = snap([{ tags: ['b', 'a'], name: 'x', id: 1 }]);
  assert.equal(a.dataJson, b.dataJson, 'unchanged data must serialize identically whatever the key order');
  assert.equal(a.rowCount, 1);
  assert.equal(a.dataJson, '[{"id":1,"name":"x","tags":["b","a"]}]');
});

test('buildTableSnapshot: arrays keep their order — in an array, order is data', async () => {
  const snap = await importFn('buildTableSnapshot');
  assert.notEqual(snap([{ id: 1, t: ['a', 'b'] }]).dataJson, snap([{ id: 1, t: ['b', 'a'] }]).dataJson);
});

test('buildTableSnapshot: nested objects are sorted recursively', async () => {
  const snap = await importFn('buildTableSnapshot');
  assert.equal(
    snap([{ id: 1, meta: { z: 1, a: { y: 2, b: 3 } } }]).dataJson,
    '[{"id":1,"meta":{"a":{"b":3,"y":2},"z":1}}]',
  );
});

test('buildTableSnapshot: a cycle serializes as "[cycle]" instead of throwing', async () => {
  const snap = await importFn('buildTableSnapshot');
  const row = { id: 1, name: 'loop' };
  row.self = row;
  const out = snap([row]);
  assert.equal(out.rowCount, 1);
  assert.ok(out.dataJson.includes('"[cycle]"'), `expected a [cycle] marker in ${out.dataJson}`);
  // A repeated (non-cyclic) reference is NOT a cycle — it is just the same value twice.
  const shared = { k: 1 };
  const out2 = snap([{ id: 1, a: shared, b: shared }]);
  assert.equal(out2.dataJson, '[{"a":{"k":1},"b":{"k":1},"id":1}]');
});

test('buildTableSnapshot: odd values degrade instead of throwing', async () => {
  const snap = await importFn('buildTableSnapshot');
  assert.deepEqual(snap(null), { rowCount: 0, dataJson: '[]' });
  assert.deepEqual(snap('nope'), { rowCount: 0, dataJson: '[]' });
  assert.deepEqual(snap([]), { rowCount: 0, dataJson: '[]' });
  const odd = snap([{ id: 1, n: NaN, u: undefined, f: () => 1, big: 2n }]);
  assert.equal(odd.rowCount, 1);
  assert.equal(odd.dataJson, '[{"big":"2","f":null,"id":1,"n":null,"u":null}]');
});

// ---------- scanPiiInRows ----------

test('scanPiiInRows: finds emails, separated phones and IBANs, per column', async () => {
  const scan = await importFn('scanPiiInRows');
  const out = scan([
    { id: 1, contact: 'ada@example.com', phone: '+30 210 1234567', iban: 'GR1601101250000000012300695' },
    { id: 2, contact: 'grace@navy.mil', phone: '(555) 123-4567', iban: '' },
  ]);
  assert.deepEqual(out, [
    { column: 'contact', kind: 'email', count: 2 },
    { column: 'iban', kind: 'iban', count: 1 },
    { column: 'phone', kind: 'phone', count: 2 },
  ]);
});

test('scanPiiInRows: card needs Luhn — a plain 16-digit id is not flagged', async () => {
  const scan = await importFn('scanPiiInRows');
  const out = scan([
    { id: 1, pan: '4242424242424242' }, // Luhn-valid → card
    { id: 2, pan: '1234567812345678' }, // 16 digits, Luhn-invalid → nothing
    { id: 3, pan: '9999888877776666' }, // a plain internal id, Luhn-invalid → nothing
  ]);
  assert.deepEqual(out, [{ column: 'pan', kind: 'card', count: 1 }]);
});

test('scanPiiInRows: separated card numbers are found; bare digit runs are not phones', async () => {
  const scan = await importFn('scanPiiInRows');
  const spaced = scan([{ id: 1, pan: '4242 4242 4242 4242' }]);
  assert.ok(spaced.some((f) => f.kind === 'card' && f.column === 'pan'), `expected a card finding in ${JSON.stringify(spaced)}`);
  // A bare 10-digit order number has no separators and no leading + → not a phone.
  assert.deepEqual(scan([{ id: 1, order_no: '1002345678' }]), []);
});

test('scanPiiInRows: dates are not phone numbers, and non-scalars are ignored', async () => {
  const scan = await importFn('scanPiiInRows');
  assert.deepEqual(scan([{ id: 1, created_at: '2026-07-26', due: '2026-07-26 14:30' }]), []);
  assert.deepEqual(scan([{ id: 1, ok: true, meta: { phone: '+30 210 1234567' } }]), []);
});

test('scanPiiInRows: counts every occurrence and sorts deterministically', async () => {
  const scan = await importFn('scanPiiInRows');
  const out = scan([{ id: 1, notes: 'write to ada@example.com or grace@navy.mil', b_col: 'x@y.io', a_col: 'z@y.io' }]);
  assert.deepEqual(out, [
    { column: 'a_col', kind: 'email', count: 1 },
    { column: 'b_col', kind: 'email', count: 1 },
    { column: 'notes', kind: 'email', count: 2 },
  ]);
});

test('scanPiiInRows: malformed input degrades to []', async () => {
  const scan = await importFn('scanPiiInRows');
  assert.deepEqual(scan(null), []);
  assert.deepEqual(scan('nope'), []);
  assert.deepEqual(scan([null, 42, 'x', []]), []);
  assert.deepEqual(scan([{ id: 1, a: '', b: '   ' }]), []);
});

// ---------- findRetentionCandidates ----------

const NOW = '2026-07-26T12:00:00.000Z';

test('findRetentionCandidates: strictly older than now - keepDays, boundary day excluded', async () => {
  const find = await importFn('findRetentionCandidates');
  const rows = [
    { id: 'a', created_at: '2026-04-27' }, // exactly 90 days before 2026-07-26 → boundary, KEPT
    { id: 'b', created_at: '2026-04-26' }, // 91 days → candidate
    { id: 'c', created_at: '2020-01-01' }, // ancient → candidate
    { id: 'd', created_at: '2026-07-26' }, // today → kept
    { id: 'e', created_at: '2026-07-30' }, // future → kept
  ];
  const out = find(rows, 'created_at', 90, NOW);
  assert.deepEqual(out.map((c) => c.rowId), ['c', 'b'], 'oldest first, boundary row excluded');
  assert.equal(out.find((c) => c.rowId === 'b').ageDays, 91);
});

test('findRetentionCandidates: keepDays 0 means everything before today', async () => {
  const find = await importFn('findRetentionCandidates');
  const out = find([{ id: 1, d: '2026-07-25' }, { id: 2, d: '2026-07-26' }], 'd', 0, NOW);
  assert.deepEqual(out, [{ rowId: '1', ageDays: 1 }]);
});

test('findRetentionCandidates: unparseable dates and id-less rows are skipped, never aged out', async () => {
  const find = await importFn('findRetentionCandidates');
  const out = find(
    [
      { id: 1, d: 'a long time ago' },
      { id: 2, d: null },
      { id: 3, d: '' },
      { d: '2000-01-01' }, // no id
      { id: 6, d: '2000-01-01' },
    ],
    'd', 30, NOW,
  );
  assert.deepEqual(out.map((c) => c.rowId), ['6']);
});

test('findRetentionCandidates: accepts the lenient date shapes, including epochs', async () => {
  const find = await importFn('findRetentionCandidates');
  const out = find(
    [
      { id: 1, d: '2020/01/01' },
      { id: 2, d: '2020-01-01T10:00:00Z' },
      { id: 3, d: 1577836800 }, // epoch seconds, 2020-01-01
      { id: 4, d: 1577836800000 }, // epoch ms
    ],
    'd', 30, NOW,
  );
  assert.equal(out.length, 4);
});

test('findRetentionCandidates: malformed input degrades to []', async () => {
  const find = await importFn('findRetentionCandidates');
  assert.deepEqual(find(null, 'd', 30, NOW), []);
  assert.deepEqual(find([{ id: 1, d: '2000-01-01' }], '', 30, NOW), []);
  assert.deepEqual(find([{ id: 1, d: '2000-01-01' }], 'd', 30, 'not a date'), []);
  assert.deepEqual(find([{ id: 1, d: '2000-01-01' }], 'd', -1, NOW), []);
  assert.deepEqual(find([{ id: 1, d: '2000-01-01' }], 'd', Number.NaN, NOW), []);
  // A row mixed in with junk is still evaluated: 2000-01-01 is 9703 calendar days before NOW.
  assert.deepEqual(find(['nope', null, { id: 1, d: '2000-01-01' }], 'd', 30, NOW), [{ rowId: '1', ageDays: 9703 }]);
});

// ---------- computeArchiveKey ----------

test('computeArchiveKey: truncates to the day, so re-runs never duplicate', async () => {
  const key = await importFn('computeArchiveKey');
  assert.equal(key('snapshot', 'orders', '2026-07-26T05:30:00.000Z'), 'snapshot:orders:2026-07-26');
  assert.equal(key('snapshot', 'orders', '2026-07-26'), key('snapshot', 'orders', '2026-07-26T23:59:59.999Z'));
  assert.notEqual(key('snapshot', 'orders', '2026-07-27'), key('snapshot', 'orders', '2026-07-26'));
  assert.notEqual(key('pii', 'orders', '2026-07-26'), key('retention', 'orders', '2026-07-26'));
  assert.notEqual(key('pii', 'orders', '2026-07-26'), key('pii', 'invoices', '2026-07-26'));
  // Hostile inputs sanitize instead of throwing.
  assert.equal(typeof key(null, undefined, null), 'string');
  assert.equal(key('a b', 'c:d', '2026-07-26'), 'a_b:c_d:2026-07-26');
});

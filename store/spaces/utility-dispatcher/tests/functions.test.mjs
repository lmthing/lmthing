/**
 * Unit tests for utility-dispatcher's pure functions — no network, no LLM, no clock.
 *
 * Functions are transpiled standalone, exactly the way the runtime injects them, so a cross-file
 * import would fail here first.
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

// ---------- discoverQueueTables ----------

test('discoverQueueTables: returns only registry tables present in the project', async () => {
  const discover = await importFn('discoverQueueTables');
  const out = discover(['deadline_alerts', 'trips', 'ledger_reports', 'not_a_queue']);
  assert.deepEqual(out.map((r) => r.table), ['deadline_alerts', 'ledger_reports']);
  const alerts = out.find((r) => r.table === 'deadline_alerts');
  assert.equal(alerts.space, 'utility-deadlines');
  assert.equal(alerts.statusFilter, 'open');
  assert.equal(alerts.titleColumn, 'label');
  assert.ok(Array.isArray(alerts.detailColumns) && alerts.detailColumns.length > 0);
});

test('discoverQueueTables: accepts {name} table objects and the append-only log recipe', async () => {
  const discover = await importFn('discoverQueueTables');
  const out = discover([{ name: 'audit_log' }, { name: 'intake_items' }]);
  assert.deepEqual(out.map((r) => r.table), ['audit_log', 'intake_items']);
  assert.equal(out.find((r) => r.table === 'audit_log').statusFilter, '', 'append-only log has no status filter');
  assert.equal(out.find((r) => r.table === 'intake_items').statusFilter, 'unrouted');
});

test('discoverQueueTables: malformed input degrades to []', async () => {
  const discover = await importFn('discoverQueueTables');
  assert.deepEqual(discover(null), []);
  assert.deepEqual(discover('nope'), []);
  assert.deepEqual(discover([42, { noName: true }]), []);
});

// ---------- collectNewRows ----------

const ROWS = [
  { id: 'c', status: 'open', createdAt: '2026-07-26T10:00:00.000Z' },
  { id: 'a', status: 'open', createdAt: '2026-07-26T08:00:00.000Z' },
  { id: 'b', status: 'dismissed', createdAt: '2026-07-26T09:00:00.000Z' },
];

test('collectNewRows: strictly-greater watermark, status filter, stable sort', async () => {
  const collect = await importFn('collectNewRows');
  // Empty watermark → everything eligible, sorted by createdAt.
  assert.deepEqual(collect(ROWS, '', 'open').map((r) => r.id), ['a', 'c']);
  // Strictly greater: a row created exactly AT the watermark was already delivered.
  assert.deepEqual(collect(ROWS, '2026-07-26T08:00:00.000Z', 'open').map((r) => r.id), ['c']);
  assert.deepEqual(collect(ROWS, '2026-07-26T10:00:00.000Z', 'open').map((r) => r.id), []);
  // No status filter → dismissed rows count too.
  assert.deepEqual(collect(ROWS, '', '').map((r) => r.id), ['a', 'b', 'c']);
});

test('collectNewRows: ties break on id; rows without createdAt are ineligible', async () => {
  const collect = await importFn('collectNewRows');
  const rows = [
    { id: 'z', createdAt: '2026-07-26T08:00:00.000Z' },
    { id: 'y', createdAt: '2026-07-26T08:00:00.000Z' },
    { id: 'x' },
  ];
  assert.deepEqual(collect(rows, '', '').map((r) => r.id), ['y', 'z']);
});

test('collectNewRows: malformed input degrades to []', async () => {
  const collect = await importFn('collectNewRows');
  assert.deepEqual(collect(null, '', ''), []);
  assert.deepEqual(collect([null, 42, 'x'], '', ''), []);
});

// ---------- renderDigest ----------

test('renderDigest: header, verbatim values, detail pairs', async () => {
  const render = await importFn('renderDigest');
  const out = render(
    'Deadline alerts',
    [{ label: 'Passport expires', dueAt: '2026-08-01', daysLeft: 6 }],
    { titleColumn: 'label', detailColumns: ['dueAt', 'daysLeft'] },
  );
  assert.match(out, /\*\*Deadline alerts\*\* — 1 new/);
  assert.match(out, /- Passport expires \(dueAt=2026-08-01, daysLeft=6\)/);
});

test('renderDigest: caps at 20 lines with a remainder tail, truncates long titles', async () => {
  const render = await importFn('renderDigest');
  const many = Array.from({ length: 25 }, (_, i) => ({ label: `item ${i}` }));
  const out = render('Findings', many, { titleColumn: 'label', detailColumns: [] });
  const bullets = out.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(bullets.length, 20);
  assert.match(out, /…and 5 more/);

  const long = render('X', [{ label: 'q'.repeat(300) }], { titleColumn: 'label', detailColumns: [] });
  const line = long.split('\n')[1];
  assert.ok(line.length <= 123, `title should be truncated, got ${line.length} chars`);
  assert.match(line, /…$/);
});

test('renderDigest: empty entries render nothing (callers must not send empty digests)', async () => {
  const render = await importFn('renderDigest');
  assert.equal(render('X', [], { titleColumn: 'a', detailColumns: [] }), '');
  assert.equal(render('X', null, null), '');
});

test('renderDigest: missing title falls back, empty details are omitted', async () => {
  const render = await importFn('renderDigest');
  const out = render('X', [{ other: 'v', d: '' }], { titleColumn: 'label', detailColumns: ['d'] });
  assert.match(out, /- \(no title\)$/m);
  assert.ok(!out.includes('d='), 'empty detail values are dropped');
});

// ---------- computeBatchKey ----------

test('computeBatchKey: stable, distinct per watermark and size, genesis-safe', async () => {
  const key = await importFn('computeBatchKey');
  assert.equal(key('7', '2026-07-26T08:00:00.000Z', 12), '7:2026-07-26T08:00:00.000Z:12');
  assert.equal(key('7', '', 3), '7:genesis:3');
  assert.notEqual(key('7', '2026-07-26T08:00:00.000Z', 12), key('7', '2026-07-26T09:00:00.000Z', 12));
  assert.notEqual(key('7', '2026-07-26T08:00:00.000Z', 12), key('7', '2026-07-26T08:00:00.000Z', 13));
  assert.equal(typeof key(null, undefined, 'nope'), 'string');
});

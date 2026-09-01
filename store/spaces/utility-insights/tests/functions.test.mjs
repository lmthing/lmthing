/**
 * Unit tests for utility-insights' pure functions — no network, no LLM, no clock.
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

// ---------- profileTables ----------

test('profileTables: per-column fill/numeric/date rates over the sampled rows', async () => {
  const profile = await importFn('profileTables');
  const tables = [
    { name: 'orders', columns: ['id', 'total', 'placed_at', 'note'] },
    'empty_table', // plain string form must be tolerated
  ];
  const samples = {
    orders: [
      { id: 1, total: 10, placed_at: '2026-07-01', note: 'a' },
      { id: 2, total: '20.5', placed_at: '2026-07-02', note: '' },
      { id: 3, total: 'n/a', placed_at: null, note: 'c' },
    ],
    empty_table: [],
  };
  const out = profile(tables, samples);
  assert.deepEqual(out.map((t) => t.table), ['empty_table', 'orders'], 'tables sorted by name');

  const orders = out.find((t) => t.table === 'orders');
  assert.equal(orders.rowCount, 3);
  assert.deepEqual(orders.columns.map((c) => c.name), ['id', 'note', 'placed_at', 'total'], 'columns sorted');

  const by = (n) => orders.columns.find((c) => c.name === n);
  assert.deepEqual(by('id'), { name: 'id', fillRate: 1, numericRate: 1, dateRate: 0 });
  assert.deepEqual(by('note'), { name: 'note', fillRate: 0.67, numericRate: 0, dateRate: 0 });
  assert.deepEqual(by('placed_at'), { name: 'placed_at', fillRate: 0.67, numericRate: 0, dateRate: 1 });
  assert.deepEqual(by('total'), { name: 'total', fillRate: 1, numericRate: 0.67, dateRate: 0 });

  const empty = out.find((t) => t.table === 'empty_table');
  assert.deepEqual(empty, { table: 'empty_table', rowCount: 0, columns: [] });
});

test('profileTables: columns seen only in samples are profiled too', async () => {
  const profile = await importFn('profileTables');
  const out = profile([{ name: 't' }], { t: [{ undeclared: 'x' }, { undeclared: 'y' }] });
  assert.deepEqual(out[0].columns.map((c) => c.name), ['undeclared']);
  assert.equal(out[0].columns[0].fillRate, 1);
});

test('profileTables: malformed input degrades to []', async () => {
  const profile = await importFn('profileTables');
  assert.deepEqual(profile(null, null), []);
  assert.deepEqual(profile('nope', undefined), []);
  assert.deepEqual(profile([{ bogus: true }, 42], {}), []);
});

test('profileTables: deterministic across repeated calls', async () => {
  const profile = await importFn('profileTables');
  const tables = [{ name: 'b', columns: ['x'] }, { name: 'a', columns: ['y'] }];
  const samples = { b: [{ x: 1 }], a: [{ y: '2026-01-01' }] };
  assert.deepEqual(profile(tables, samples), profile(tables, samples));
});

// ---------- summarizeNumericColumn ----------

test('summarizeNumericColumn: stats over a numeric column, rounded to 2dp', async () => {
  const summarize = await importFn('summarizeNumericColumn');
  const out = summarize([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 10 }], 'v');
  assert.deepEqual(out, { count: 4, min: 1, max: 10, mean: 4, median: 2.5, sum: 16 });
});

test('summarizeNumericColumn: numeric strings count; means round to 2dp', async () => {
  const summarize = await importFn('summarizeNumericColumn');
  const out = summarize([{ v: '1' }, { v: 1 }, { v: '2' }], 'v');
  assert.deepEqual(out, { count: 3, min: 1, max: 2, mean: 1.33, median: 1, sum: 4 });
});

test('summarizeNumericColumn: a mostly non-numeric column refuses to summarize', async () => {
  const summarize = await importFn('summarizeNumericColumn');
  const EMPTY = { count: 0, min: null, max: null, mean: null, median: null, sum: null };
  // 1 of 3 values numeric → below half → refuse.
  assert.deepEqual(summarize([{ v: 'a' }, { v: 'b' }, { v: 1 }], 'v'), EMPTY);
  // Exactly half is still summarized (the boundary is "fewer than half").
  assert.deepEqual(summarize([{ v: 'a' }, { v: 1 }], 'v'), { count: 1, min: 1, max: 1, mean: 1, median: 1, sum: 1 });
});

test('summarizeNumericColumn: empty values are absent data, not zeros', async () => {
  const summarize = await importFn('summarizeNumericColumn');
  const out = summarize([{ v: 4 }, { v: null }, { v: '' }, { v: undefined }], 'v');
  assert.deepEqual(out, { count: 1, min: 4, max: 4, mean: 4, median: 4, sum: 4 });
});

test('summarizeNumericColumn: malformed input degrades to the null shape', async () => {
  const summarize = await importFn('summarizeNumericColumn');
  const EMPTY = { count: 0, min: null, max: null, mean: null, median: null, sum: null };
  assert.deepEqual(summarize(null, 'v'), EMPTY);
  assert.deepEqual(summarize([{ v: 1 }], ''), EMPTY);
  assert.deepEqual(summarize('nope', 'v'), EMPTY);
  assert.deepEqual(summarize([{}, null, 7], 'v'), EMPTY);
});

// ---------- detectOutliers ----------

const idRows = (values) => values.map((v, i) => ({ id: i + 1, v }));

test('detectOutliers: a value exactly on the fence is not an outlier; just past it is', async () => {
  const detect = await importFn('detectOutliers');
  // n=9 → Q1 = 3, Q3 = 7, IQR = 4, upper fence = 7 + 6 = 13.
  assert.deepEqual(detect(idRows([1, 2, 3, 4, 5, 6, 7, 8, 13]), 'v'), [], 'value on the fence stays');
  assert.deepEqual(detect(idRows([1, 2, 3, 4, 5, 6, 7, 8, 14]), 'v'), [{ rowId: '9', value: 14 }]);
});

test('detectOutliers: needs at least 4 usable numeric values', async () => {
  const detect = await importFn('detectOutliers');
  assert.deepEqual(detect(idRows([1, 2, 500]), 'v'), [], 'three points are noise, not a distribution');
  assert.deepEqual(detect(idRows([1, 1, 1, 1, 1, 1, 1, 1, 99]), 'v'), [{ rowId: '9', value: 99 }]);
});

test('detectOutliers: rows without an id are skipped entirely', async () => {
  const detect = await importFn('detectOutliers');
  const rows = [...idRows([1, 2, 3, 4, 5, 6, 7, 8, 14]), { v: 9999 }];
  assert.deepEqual(detect(rows, 'v'), [{ rowId: '9', value: 14 }], 'the id-less extreme is invisible');
  // Dropping id-less rows can take the sample below the minimum.
  assert.deepEqual(detect([{ id: 1, v: 1 }, { id: 2, v: 2 }, { id: 3, v: 3 }, { v: 400 }], 'v'), []);
});

test('detectOutliers: malformed input degrades to []', async () => {
  const detect = await importFn('detectOutliers');
  assert.deepEqual(detect(null, 'v'), []);
  assert.deepEqual(detect('nope', 'v'), []);
  assert.deepEqual(detect(idRows([1, 2, 3, 4]), ''), []);
  assert.deepEqual(detect([null, 7, { id: 1, v: 'x' }], 'v'), []);
});

// ---------- formatReportMarkdown ----------

test('formatReportMarkdown: renders a deterministic, table-sorted report', async () => {
  const format = await importFn('formatReportMarkdown');
  const profile = [
    { table: 'orders', rowCount: 3, columns: [{ name: 'id' }, { name: 'total' }, { name: 'note' }] },
    { table: 'a', rowCount: 0, columns: [] },
  ];
  const highlights = ['first', { label: 'orders.total', detail: 'sum 30' }];
  const out = format(profile, highlights, '2026-W31');
  assert.equal(
    out,
    [
      '# Data digest — 2026-W31',
      '',
      '## Highlights',
      '',
      '- first',
      '- orders.total — sum 30',
      '',
      '## Tables',
      '',
      '| Table | Rows sampled | Columns |',
      '| --- | --- | --- |',
      '| a | 0 | 0 |',
      '| orders | 3 | 3 |',
    ].join('\n'),
  );
  assert.equal(out, format(profile, highlights, '2026-W31'), 'same inputs → byte-identical output');
});

test('formatReportMarkdown: accepts the { tables: [...] } wrapper and an empty highlight list', async () => {
  const format = await importFn('formatReportMarkdown');
  const out = format({ tables: [{ table: 't', rowCount: 1, columns: [] }] }, [], '2026-W01');
  assert.ok(out.includes('_No highlights this period._'));
  assert.ok(out.includes('| t | 1 | 0 |'));
});

test('formatReportMarkdown: malformed or empty input degrades to an empty string', async () => {
  const format = await importFn('formatReportMarkdown');
  assert.equal(format(null, null, null), '');
  assert.equal(format([], [], '2026-W31'), '');
  assert.equal(format('nope', 'nope', 5), '');
  assert.equal(format([{ bogus: true }], [{}], 'x'), '');
});
